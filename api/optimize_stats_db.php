<?php
/**
 * Optimize Database & Add Indexes
 * Access via: https://www.prima49.com/mini_erp/api/optimize_stats_db.php
 */
require_once __DIR__ . '/config.php';

header('Content-Type: text/plain; charset=utf-8');

function log_msg($msg) {
    echo "[" . date('H:i:s') . "] " . $msg . "\n";
    flush();
}

try {
    $pdo = db_connect();
    log_msg("--- Checking & Adding Indexes ---");

    $indexes_to_check = [
        'appointments' => 'customer_id',
        'orders' => 'customer_id',
        'call_history' => 'customer_id'
    ];

    foreach ($indexes_to_check as $table => $col) {
        $found = false;
        // Check if index exists
        try {
            $stmt = $pdo->query("SHOW INDEX FROM `$table` WHERE Column_name = '$col'");
            if ($stmt->fetch()) {
                 $found = true;
            }
        } catch (Exception $e) {
            log_msg("Error checking index on $table: " . $e->getMessage());
            continue;
        }

        if ($found) {
            log_msg("✓ Index on $table($col) already exists.");
        } else {
            log_msg("Creating index on $table($col)... This might take a while...");
            try {
                $pdo->exec("CREATE INDEX idx_{$table}_{$col} ON `$table`(`$col`)");
                log_msg("✓ Created index idx_{$table}_{$col} successfully.");
            } catch (Exception $e) {
                log_msg("✗ Failed to create index on $table: " . $e->getMessage());
            }
        }
    }

    log_msg("\n--- Optimization Complete ---");
    log_msg("Now you can try running update_stats_safe.php again.");

} catch (Throwable $e) {
    log_msg("CRITICAL ERROR: " . $e->getMessage());
}
