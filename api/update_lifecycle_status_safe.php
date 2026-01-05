<?php
/**
 * Update Customer Lifecycle Status - ULTRA SAFE MODE
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
 * เงื่อนไข lifecycle_status:
 * 1. FollowUp = มี appointment ที่ status = 'รอดำเนินการ' (ยังไม่เสร็จสิ้น)
 * 2. Old3Months = ผู้ดูแลปัจจุบัน (assigned_to) ขายได้ภายใน 3 เดือนล่าสุด
 * 3. New = ไม่เข้าเงื่อนไขข้างต้น
 * 
 * Access via: https://www.prima49.com/mini_erp/api/update_lifecycle_status_safe.php
 * Check progress: https://www.prima49.com/mini_erp/api/update_lifecycle_progress.php
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
$checkpoint_file = __DIR__ . '/update_lifecycle_checkpoint.txt';
$progress_file = __DIR__ . '/update_lifecycle_progress.json';

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
    global $checkpoint_file, $progress_file;
    @unlink($checkpoint_file);
    @unlink($progress_file);
}

function save_progress($data) {
    global $progress_file;
    $data['updated_at'] = date('Y-m-d H:i:s');
    file_put_contents($progress_file, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

try {
    $pdo = db_connect();
    // Set short lock wait to fail fast if there's a problem
    $pdo->exec("SET SESSION innodb_lock_wait_timeout = 10");

    log_msg("╔════════════════════════════════════════════════════════════╗");
    log_msg("║     ULTRA SAFE Lifecycle Status Update                    ║");
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

    // Stats tracking
    $stats = [
        'New' => 0,
        'Old3Months' => 0,
        'FollowUp' => 0
    ];

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
            save_progress([
                'status' => 'paused',
                'processed' => $processed,
                'total' => $total_customers,
                'percent' => round(($processed / $total_customers) * 100, 1),
                'stats' => $stats
            ]);
            exit;
        }

        // Get batch of customer IDs with assigned_to
        $stmt = $pdo->prepare("SELECT customer_id, assigned_to FROM customers ORDER BY customer_id LIMIT :limit OFFSET :offset");
        $stmt->bindValue(':limit', $BATCH_SIZE, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $processed, PDO::PARAM_INT);
        $stmt->execute();
        $customers = $stmt->fetchAll(PDO::FETCH_ASSOC);

        if (empty($customers)) break;

        $customer_ids = array_column($customers, 'customer_id');
        $ids_str = "'" . implode("','", $customer_ids) . "'";

        // Build customer -> assigned_to map
        $assigned_map = [];
        foreach ($customers as $c) {
            $assigned_map[$c['customer_id']] = $c['assigned_to'];
        }

        // ========== Check FollowUp (has open appointments) ==========
        $followup_customers = [];
        try {
            $stmt = $pdo->query("SELECT DISTINCT customer_id FROM appointments WHERE customer_id IN ($ids_str) AND status = 'รอดำเนินการ'");
            $followup_customers = $stmt->fetchAll(PDO::FETCH_COLUMN);
        } catch (Exception $e) { /* ignore */ }

        // ========== Check Old3Months (has order by assigned_to in last 3 months) ==========
        $old3months_customers = [];
        try {
            // Use a simpler approach - check each customer individually in the batch
            foreach ($customers as $c) {
                $cid = $c['customer_id'];
                $assigned = $c['assigned_to'];
                if (!$assigned) continue;
                
                $check_stmt = $pdo->prepare("
                    SELECT 1 FROM orders 
                    WHERE customer_id = ? 
                      AND creator_id = ?
                      AND order_status NOT IN ('Cancelled', 'BadDebt')
                      AND order_date >= DATE_SUB(CURDATE(), INTERVAL 3 MONTH)
                    LIMIT 1
                ");
                $check_stmt->execute([$cid, $assigned]);
                if ($check_stmt->fetchColumn()) {
                    $old3months_customers[] = $cid;
                }
            }
        } catch (Exception $e) { /* ignore */ }

        // ========== Update each customer ==========
        $update_stmt = $pdo->prepare("UPDATE customers SET lifecycle_status = ? WHERE customer_id = ?");

        foreach ($customer_ids as $cid) {
            $new_status = 'New'; // Default

            // Priority: FollowUp > Old3Months > New
            if (in_array($cid, $followup_customers)) {
                $new_status = 'FollowUp';
            } elseif (in_array($cid, $old3months_customers)) {
                $new_status = 'Old3Months';
            }

            try {
                $update_stmt->execute([$new_status, $cid]);
                $stats[$new_status]++;
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

        // Save checkpoint & progress every 10 batches
        if ($batch_count % 10 == 0) {
            save_checkpoint($processed);
            save_progress([
                'status' => 'running',
                'processed' => $processed,
                'total' => $total_customers,
                'percent' => $percent,
                'elapsed_minutes' => $elapsed,
                'stats' => $stats
            ]);
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
    log_msg("");
    log_msg("📊 Status Summary:");
    log_msg("   - New: " . number_format($stats['New']));
    log_msg("   - Old3Months: " . number_format($stats['Old3Months']));
    log_msg("   - FollowUp: " . number_format($stats['FollowUp']));
    log_msg("════════════════════════════════════════════════════════════════");

    // Save final progress
    save_progress([
        'status' => 'completed',
        'processed' => $processed,
        'total' => $total_customers,
        'percent' => 100,
        'elapsed_minutes' => round((time() - $start_time) / 60, 1),
        'stats' => $stats
    ]);

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
