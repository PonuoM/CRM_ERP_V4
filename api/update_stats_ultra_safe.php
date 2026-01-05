<?php
/**
 * Update Customer Statistics - ULTRA SAFE MODE
 * Designed for Shared Hosting with strict resource limits
 * 
 * Features:
 * - Ultra small batch size (50 records)
 * - Long pause between batches (0.5s)
 * - No transactions (prevents long locks)
 * - Checkpoint support (can resume if interrupted)
 * - Auto-stop after 55 minutes (prevents hosting kill)
 * - Real-time progress display
 * 
 * Access via: https://www.prima49.com/mini_erp/api/update_stats_ultra_safe.php
 */
require_once __DIR__ . '/config.php';

// Prevent timeout (but we'll still auto-stop at 55 min for safety)
set_time_limit(0);
ini_set('memory_limit', '256M');

header('Content-Type: text/plain; charset=utf-8');

// Disable buffering to show progress immediately
if (function_exists('apache_setenv')) {
    @apache_setenv('no-gzip', 1);
}
@ini_set('zlib.output_compression', 0);
@ini_set('implicit_flush', 1);
for ($i = 0; $i < ob_get_level(); $i++) { ob_end_flush(); }
ob_implicit_flush(1);

// --- Configuration ---
$BATCH_SIZE = 50;           // Ultra small batch
$PAUSE_SECONDS = 0.5;       // Half second pause between batches
$MAX_RUNTIME_MINUTES = 55;  // Auto-stop before hosting kills us

$start_time = time();
$checkpoint_file = __DIR__ . '/update_stats_checkpoint.txt';

function log_msg($msg) {
    echo "[" . date('H:i:s') . "] " . $msg . "\n";
    flush();
}

function save_checkpoint($offset) {
    global $checkpoint_file;
    file_put_contents($checkpoint_file, $offset);
}

function load_checkpoint() {
    global $checkpoint_file;
    if (file_exists($checkpoint_file)) {
        return (int)file_get_contents($checkpoint_file);
    }
    return 0;
}

function clear_checkpoint() {
    global $checkpoint_file;
    @unlink($checkpoint_file);
}

try {
    $pdo = db_connect();
    // Set short lock wait to fail fast if there's a problem
    $pdo->exec("SET SESSION innodb_lock_wait_timeout = 10");

    log_msg("╔════════════════════════════════════════════════════════════╗");
    log_msg("║     ULTRA SAFE Customer Statistics Update                 ║");
    log_msg("╚════════════════════════════════════════════════════════════╝");
    log_msg("");
    log_msg("Settings:");
    log_msg("  - Batch Size: $BATCH_SIZE records");
    log_msg("  - Pause: {$PAUSE_SECONDS}s between batches");
    log_msg("  - Max Runtime: {$MAX_RUNTIME_MINUTES} minutes");
    log_msg("");

    // Get total customers
    $stmt = $pdo->query("SELECT COUNT(*) FROM customers");
    $total_customers = $stmt->fetchColumn();
    log_msg("Total customers: " . number_format($total_customers));

    // Check for checkpoint
    $processed = load_checkpoint();
    if ($processed > 0) {
        log_msg("⚡ Resuming from checkpoint: " . number_format($processed));
    }

    log_msg("");
    log_msg("Starting update...");
    log_msg("────────────────────────────────────────────────────────────────");

    // Prepare update statement
    $update_sql = "UPDATE customers SET 
        total_calls = :total_calls,
        order_count = :order_count,
        total_purchases = :total_purchases,
        first_order_date = :first_order_date,
        last_order_date = :last_order_date,
        follow_up_count = :follow_up_count,
        last_follow_up_date = :last_follow_up_date,
        has_sold_before = :has_sold_before,
        is_new_customer = :is_new_customer,
        is_repeat_customer = :is_repeat_customer
        WHERE customer_id = :customer_id";
    $update_stmt = $pdo->prepare($update_sql);

    $batch_count = 0;
    $error_count = 0;

    while ($processed < $total_customers) {
        // Check max runtime
        $elapsed_minutes = (time() - $start_time) / 60;
        if ($elapsed_minutes >= $MAX_RUNTIME_MINUTES) {
            log_msg("");
            log_msg("⏱️  AUTO-STOP: Reached {$MAX_RUNTIME_MINUTES} minute limit.");
            log_msg("   Checkpoint saved at: " . number_format($processed));
            log_msg("   Run script again to continue.");
            save_checkpoint($processed);
            exit;
        }

        // Get batch of customer IDs
        $stmt = $pdo->prepare("SELECT customer_id FROM customers ORDER BY customer_id LIMIT :limit OFFSET :offset");
        $stmt->bindValue(':limit', $BATCH_SIZE, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $processed, PDO::PARAM_INT);
        $stmt->execute();
        $customer_ids = $stmt->fetchAll(PDO::FETCH_COLUMN);

        if (empty($customer_ids)) break;

        $ids_str = implode(',', $customer_ids);

        // Fetch stats for this batch
        $calls = [];
        $orders = [];
        $appointments = [];

        try {
            $stmt = $pdo->query("SELECT customer_id, COUNT(*) as cnt FROM call_history WHERE customer_id IN ($ids_str) GROUP BY customer_id");
            while ($row = $stmt->fetch()) $calls[$row['customer_id']] = $row['cnt'];
        } catch (Exception $e) { /* ignore */ }

        try {
            $stmt = $pdo->query("SELECT customer_id, COUNT(*) as cnt, SUM(total_amount) as sum_amt, MIN(order_date) as first_dt, MAX(order_date) as last_dt FROM orders WHERE customer_id IN ($ids_str) GROUP BY customer_id");
            while ($row = $stmt->fetch()) $orders[$row['customer_id']] = $row;
        } catch (Exception $e) { /* ignore */ }

        try {
            $stmt = $pdo->query("SELECT customer_id, COUNT(*) as cnt, MAX(date) as last_dt FROM appointments WHERE customer_id IN ($ids_str) GROUP BY customer_id");
            while ($row = $stmt->fetch()) $appointments[$row['customer_id']] = $row;
        } catch (Exception $e) { /* ignore */ }

        // Update each customer (NO Transaction - each update is independent)
        foreach ($customer_ids as $cid) {
            $c_calls = $calls[$cid] ?? 0;
            $c_orders = $orders[$cid] ?? ['cnt' => 0, 'sum_amt' => 0, 'first_dt' => null, 'last_dt' => null];
            $c_apps = $appointments[$cid] ?? ['cnt' => 0, 'last_dt' => null];

            try {
                $update_stmt->execute([
                    ':total_calls' => $c_calls,
                    ':order_count' => $c_orders['cnt'],
                    ':total_purchases' => $c_orders['sum_amt'] ?? 0,
                    ':first_order_date' => $c_orders['first_dt'],
                    ':last_order_date' => $c_orders['last_dt'],
                    ':follow_up_count' => $c_apps['cnt'],
                    ':last_follow_up_date' => $c_apps['last_dt'],
                    ':has_sold_before' => ($c_orders['cnt'] > 0 ? 1 : 0),
                    ':is_new_customer' => ($c_orders['cnt'] == 0 ? 1 : 0),
                    ':is_repeat_customer' => ($c_orders['cnt'] > 1 ? 1 : 0),
                    ':customer_id' => $cid
                ]);
            } catch (Exception $e) {
                $error_count++;
                if ($error_count <= 5) {
                    log_msg("  ⚠️ Error updating customer $cid: " . $e->getMessage());
                }
            }
        }

        $processed += count($customer_ids);
        $batch_count++;

        // Progress display every batch
        $percent = round(($processed / $total_customers) * 100, 1);
        $elapsed = round((time() - $start_time) / 60, 1);
        log_msg("✓ Processed: " . number_format($processed) . " / " . number_format($total_customers) . " ({$percent}%) | Time: {$elapsed}m");

        // Save checkpoint every 10 batches
        if ($batch_count % 10 == 0) {
            save_checkpoint($processed);
        }

        // Pause to let MySQL breathe
        usleep($PAUSE_SECONDS * 1000000);
    }

    log_msg("");
    log_msg("════════════════════════════════════════════════════════════════");
    log_msg("✅ UPDATE COMPLETED SUCCESSFULLY!");
    log_msg("   Total processed: " . number_format($processed));
    log_msg("   Total batches: " . number_format($batch_count));
    log_msg("   Errors: " . number_format($error_count));
    log_msg("   Time taken: " . round((time() - $start_time) / 60, 1) . " minutes");
    log_msg("════════════════════════════════════════════════════════════════");

    // Clear checkpoint on success
    clear_checkpoint();

} catch (Throwable $e) {
    log_msg("");
    log_msg("❌ CRITICAL ERROR: " . $e->getMessage());
    log_msg("   Checkpoint saved. Run script again to resume.");
    if (isset($processed)) {
        save_checkpoint($processed);
    }
}
