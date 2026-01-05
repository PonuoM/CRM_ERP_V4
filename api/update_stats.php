<?php
/**
 * Update Customer Statistics via PHP (Batch Processing)
 * Access via: https://www.prima49.com/mini_erp/api/update_stats.php
 */
require_once __DIR__ . '/config.php';

// Prevent timeout
set_time_limit(0);
ini_set('memory_limit', '512M');

header('Content-Type: text/plain; charset=utf-8');
// Disable buffering to show progress immediately
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
    log_msg("--- Starting Customer Statistics Update ---");

    // 1. Get total customers
    $stmt = $pdo->query("SELECT COUNT(*) FROM customers");
    $total_customers = $stmt->fetchColumn();
    log_msg("Total customers to process: " . number_format($total_customers));

    $batch_size = 500;
    $processed = 0;
    
    // 2. Process in batches
    while ($processed < $total_customers) {
        $stmt = $pdo->prepare("SELECT customer_id FROM customers ORDER BY customer_id LIMIT :limit OFFSET :offset");
        $stmt->bindValue(':limit', $batch_size, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $processed, PDO::PARAM_INT);
        $stmt->execute();
        $customer_ids = $stmt->fetchAll(PDO::FETCH_COLUMN);

        if (empty($customer_ids)) break;

        // Collect stats for this batch
        $ids_str = implode(',', $customer_ids);

        // 2.1 Get Calls
        $calls = [];
        $stmt = $pdo->query("SELECT customer_id, COUNT(*) as cnt FROM call_history WHERE customer_id IN ($ids_str) GROUP BY customer_id");
        while ($row = $stmt->fetch()) $calls[$row['customer_id']] = $row['cnt'];

        // 2.2 Get Orders
        $orders = [];
        $stmt = $pdo->query("SELECT customer_id, COUNT(*) as cnt, SUM(total_amount) as sum_amt, MIN(order_date) as first_dt, MAX(order_date) as last_dt FROM orders WHERE customer_id IN ($ids_str) GROUP BY customer_id");
        while ($row = $stmt->fetch()) $orders[$row['customer_id']] = $row;

        // 2.3 Get Appointments
        $appointments = [];
        $stmt = $pdo->query("SELECT customer_id, COUNT(*) as cnt, MAX(date) as last_dt FROM appointments WHERE customer_id IN ($ids_str) GROUP BY customer_id");
        while ($row = $stmt->fetch()) $appointments[$row['customer_id']] = $row;

        // 2.4 Update each customer in batch
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

        $pdo->beginTransaction();
        foreach ($customer_ids as $cid) {
            $c_calls = $calls[$cid] ?? 0;
            $c_orders = $orders[$cid] ?? ['cnt' => 0, 'sum_amt' => 0, 'first_dt' => null, 'last_dt' => null];
            $c_apps = $appointments[$cid] ?? ['cnt' => 0, 'last_dt' => null];

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
        }
        $pdo->commit();

        $processed += count($customer_ids);
        log_msg("Processed: " . number_format($processed) . " / " . number_format($total_customers));
        
        // Prevent server overload
        usleep(100000); // 0.1s pause
    }

    log_msg("--- Update Completed Successfully ---");

} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    log_msg("ERROR: " . $e->getMessage());
}
