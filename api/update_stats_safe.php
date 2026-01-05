<?php
/**
 * Update Customer Statistics via PHP (Ultra Safe & No Transaction)
 * Access via: https://www.prima49.com/mini_erp/api/update_stats_safe.php
 */
require_once __DIR__ . '/config.php';

// Prevent timeout
set_time_limit(0);
ini_set('memory_limit', '512M');

header('Content-Type: text/plain; charset=utf-8');
// Disable buffering
if (function_exists('apache_setenv')) {
    @apache_setenv('no-gzip', 1);
}
@ini_set('zlib.output_compression', 0);
@ini_set('implicit_flush', 1);
for ($i = 0; $i < ob_get_level(); $i++) { ob_end_flush(); }
ob_implicit_flush(1);

function log_msg($msg) {
    echo "[" . date('H:i:s') . "] " . $msg . "\n";
    flush();
}

try {
    $pdo = db_connect();
    // Set wait timeout to minimal to fail fast if locked
    $pdo->exec("SET SESSION innodb_lock_wait_timeout = 5"); 

    log_msg("--- Starting Customer Statistics Update (Ultra Safe Mode) ---");

    // 1. Get total customers
    $stmt = $pdo->query("SELECT COUNT(*) FROM customers");
    $total_customers = $stmt->fetchColumn();
    log_msg("Total customers to process: " . number_format($total_customers));

    // Reduced batch size to minimal
    $batch_size = 100;
    $processed = 0;
    
    // Start from offset (can be adjusted if script fails halfway)
    $offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;
    if ($offset > 0) {
        $processed = $offset;
        log_msg("Resuming from offset: " . number_format($offset));
    }
    
    // Check for running from last success
    $last_success_file = __DIR__ . '/update_stats_last_offset.txt';
    if ($offset == 0 && file_exists($last_success_file)) {
        $last_offset = (int)file_get_contents($last_success_file);
        if ($last_offset > 0) {
            log_msg("Found checkpoint at offset: " . number_format($last_offset) . ". processing from there.");
            $processed = $last_offset;
        }
    }

    while ($processed < $total_customers) {
        // Prepare statement for updating single customer
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

        // Get Batch IDs
        $stmt = $pdo->prepare("SELECT customer_id FROM customers ORDER BY customer_id LIMIT :limit OFFSET :offset");
        $stmt->bindValue(':limit', $batch_size, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $processed, PDO::PARAM_INT);
        $stmt->execute();
        $customer_ids = $stmt->fetchAll(PDO::FETCH_COLUMN);

        if (empty($customer_ids)) break;

        // Collect stats
        $ids_str = implode(',', $customer_ids);

        // Get current stats to reduce queries
        $calls = [];
        try {
            $stmt = $pdo->query("SELECT customer_id, COUNT(*) as cnt FROM call_history WHERE customer_id IN ($ids_str) GROUP BY customer_id");
            while ($row = $stmt->fetch()) $calls[$row['customer_id']] = $row['cnt'];
        } catch (Exception $e) { /* ignore */ }

        $orders = [];
        try {
            $stmt = $pdo->query("SELECT customer_id, COUNT(*) as cnt, SUM(total_amount) as sum_amt, MIN(order_date) as first_dt, MAX(order_date) as last_dt FROM orders WHERE customer_id IN ($ids_str) GROUP BY customer_id");
            while ($row = $stmt->fetch()) $orders[$row['customer_id']] = $row;
        } catch (Exception $e) { /* ignore */ }

        $appointments = [];
        try {
            $stmt = $pdo->query("SELECT customer_id, COUNT(*) as cnt, MAX(date) as last_dt FROM appointments WHERE customer_id IN ($ids_str) GROUP BY customer_id");
            while ($row = $stmt->fetch()) $appointments[$row['customer_id']] = $row;
        } catch (Exception $e) { /* ignore */ }

        // Update loop (NO Transaction to prevent long locks)
        foreach ($customer_ids as $cid) {
            $c_calls = $calls[$cid] ?? 0;
            $c_orders = $orders[$cid] ?? ['cnt' => 0, 'sum_amt' => 0, 'first_dt' => null, 'last_dt' => null];
            $c_apps = $appointments[$cid] ?? ['cnt' => 0, 'last_dt' => null];
            
            // Logic to calculate derived fields
            $has_sold_before = ($c_orders['cnt'] > 0 ? 1 : 0);
            $is_new_customer = ($c_orders['cnt'] == 0 ? 1 : 0);
            $is_repeat_customer = ($c_orders['cnt'] > 1 ? 1 : 0);

            try {
                $update_stmt->execute([
                    ':total_calls' => $c_calls,
                    ':order_count' => $c_orders['cnt'],
                    ':total_purchases' => $c_orders['sum_amt'] ?? 0,
                    ':first_order_date' => $c_orders['first_dt'],
                    ':last_order_date' => $c_orders['last_dt'],
                    ':follow_up_count' => $c_apps['cnt'],
                    ':last_follow_up_date' => $c_apps['last_dt'],
                    ':has_sold_before' => $has_sold_before,
                    ':is_new_customer' => $is_new_customer,
                    ':is_repeat_customer' => $is_repeat_customer,
                    ':customer_id' => $cid
                ]);
            } catch (Exception $e) {
                log_msg("  Error updating customer $cid: " . $e->getMessage());
            }
        }

        $processed += count($customer_ids);
        log_msg("Processed: " . number_format($processed) . " / " . number_format($total_customers));
        
        // Save Checkpoint
        file_put_contents($last_success_file, $processed);
        
        // Sleep to release resources
        usleep(200000); // 0.2s pause
    }

    log_msg("--- Update Completed Successfully ---");
    // Clear checkpoint
    @unlink($last_success_file);

} catch (Throwable $e) {
    log_msg("CRITICAL ERROR: " . $e->getMessage());
}
