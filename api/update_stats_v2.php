<?php
/**
 * Update Customer Statistics - ULTRA SAFE MODE V2
 * With File-Based Progress Reporting (For Shared Hosting)
 * 
 * Access via: https://www.prima49.com/mini_erp/api/update_stats_v2.php
 * Check progress: https://www.prima49.com/mini_erp/api/update_stats_progress.php
 */
require_once __DIR__ . '/config.php';

set_time_limit(0);
ini_set('memory_limit', '256M');

// --- Configuration ---
$BATCH_SIZE = 50;
$PAUSE_SECONDS = 0.5;
$MAX_RUNTIME_MINUTES = 55;

$start_time = time();
$checkpoint_file = __DIR__ . '/update_stats_checkpoint.txt';
$progress_file = __DIR__ . '/update_stats_progress.json';

// Lock file to prevent multiple runs
$lock_file = __DIR__ . '/update_stats.lock';

function update_progress($data) {
    global $progress_file;
    $data['updated_at'] = date('Y-m-d H:i:s');
    file_put_contents($progress_file, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

function save_checkpoint($offset) {
    global $checkpoint_file;
    file_put_contents($checkpoint_file, $offset);
}

function load_checkpoint() {
    global $checkpoint_file;
    return file_exists($checkpoint_file) ? (int)file_get_contents($checkpoint_file) : 0;
}

function clear_checkpoint() {
    global $checkpoint_file, $lock_file;
    @unlink($checkpoint_file);
    @unlink($lock_file);
}

// Check for existing run
if (file_exists($lock_file)) {
    $lock_time = filemtime($lock_file);
    if (time() - $lock_time < 3600) { // Less than 1 hour old
        header('Content-Type: application/json');
        echo json_encode([
            'status' => 'already_running',
            'message' => 'Script is already running. Check progress at api/update_stats_progress.php',
            'lock_age_seconds' => time() - $lock_time
        ]);
        exit;
    }
    // Stale lock, remove it
    unlink($lock_file);
}

// Create lock
file_put_contents($lock_file, date('Y-m-d H:i:s'));

header('Content-Type: application/json');

try {
    $pdo = db_connect();
    $pdo->exec("SET SESSION innodb_lock_wait_timeout = 10");

    // Get total customers
    $stmt = $pdo->query("SELECT COUNT(*) FROM customers");
    $total_customers = $stmt->fetchColumn();

    // Check for checkpoint
    $processed = load_checkpoint();

    update_progress([
        'status' => 'running',
        'total' => $total_customers,
        'processed' => $processed,
        'percent' => round(($processed / $total_customers) * 100, 1),
        'started_at' => date('Y-m-d H:i:s'),
        'message' => 'Starting update...'
    ]);

    // Quick response to browser (script continues in background)
    echo json_encode([
        'status' => 'started',
        'total' => $total_customers,
        'resuming_from' => $processed,
        'message' => 'Update started. Check progress at api/update_stats_progress.php'
    ]);
    
    // Close connection to browser but keep running
    if (function_exists('fastcgi_finish_request')) {
        fastcgi_finish_request();
    } else {
        // Fallback for non-FPM environments
        ignore_user_abort(true);
        header('Connection: close');
        header('Content-Length: ' . ob_get_length());
        ob_end_flush();
        flush();
    }

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
            update_progress([
                'status' => 'paused',
                'total' => $total_customers,
                'processed' => $processed,
                'percent' => round(($processed / $total_customers) * 100, 1),
                'message' => "Auto-stopped at {$MAX_RUNTIME_MINUTES} min. Run again to continue.",
                'errors' => $error_count
            ]);
            save_checkpoint($processed);
            @unlink($lock_file);
            exit;
        }

        // Get batch
        $stmt = $pdo->prepare("SELECT customer_id FROM customers ORDER BY customer_id LIMIT :limit OFFSET :offset");
        $stmt->bindValue(':limit', $BATCH_SIZE, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $processed, PDO::PARAM_INT);
        $stmt->execute();
        $customer_ids = $stmt->fetchAll(PDO::FETCH_COLUMN);

        if (empty($customer_ids)) break;

        $ids_str = implode(',', $customer_ids);

        // Fetch stats
        $calls = [];
        $orders = [];
        $appointments = [];

        try {
            $stmt = $pdo->query("SELECT customer_id, COUNT(*) as cnt FROM call_history WHERE customer_id IN ($ids_str) GROUP BY customer_id");
            while ($row = $stmt->fetch()) $calls[$row['customer_id']] = $row['cnt'];
        } catch (Exception $e) {}

        try {
            $stmt = $pdo->query("SELECT customer_id, COUNT(*) as cnt, SUM(total_amount) as sum_amt, MIN(order_date) as first_dt, MAX(order_date) as last_dt FROM orders WHERE customer_id IN ($ids_str) GROUP BY customer_id");
            while ($row = $stmt->fetch()) $orders[$row['customer_id']] = $row;
        } catch (Exception $e) {}

        try {
            $stmt = $pdo->query("SELECT customer_id, COUNT(*) as cnt, MAX(date) as last_dt FROM appointments WHERE customer_id IN ($ids_str) GROUP BY customer_id");
            while ($row = $stmt->fetch()) $appointments[$row['customer_id']] = $row;
        } catch (Exception $e) {}

        // Update each customer
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
            }
        }

        $processed += count($customer_ids);
        $batch_count++;

        // Update progress file every batch
        update_progress([
            'status' => 'running',
            'total' => $total_customers,
            'processed' => $processed,
            'percent' => round(($processed / $total_customers) * 100, 1),
            'batch' => $batch_count,
            'elapsed_minutes' => round($elapsed_minutes, 1),
            'errors' => $error_count,
            'message' => 'Processing...'
        ]);

        // Save checkpoint every 10 batches
        if ($batch_count % 10 == 0) {
            save_checkpoint($processed);
        }

        usleep($PAUSE_SECONDS * 1000000);
    }

    // Done!
    update_progress([
        'status' => 'completed',
        'total' => $total_customers,
        'processed' => $processed,
        'percent' => 100,
        'elapsed_minutes' => round((time() - $start_time) / 60, 1),
        'errors' => $error_count,
        'message' => 'Update completed successfully!'
    ]);

    clear_checkpoint();

} catch (Throwable $e) {
    update_progress([
        'status' => 'error',
        'message' => $e->getMessage(),
        'processed' => $processed ?? 0
    ]);
    @unlink($lock_file);
}
