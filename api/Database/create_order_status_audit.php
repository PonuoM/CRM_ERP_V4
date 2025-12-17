<?php
require_once __DIR__ . "/../config.php";

$pdo = db_connect();

echo "<h2>Setting up Order Status Audit Log + Detailed Triggers...</h2>";

try {
    // 1. Create Table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS order_status_logs (
            id INT NOT NULL AUTO_INCREMENT,
            order_id VARCHAR(32) NOT NULL,
            previous_status VARCHAR(50) NULL,
            new_status VARCHAR(50) NULL,
            previous_tracking VARCHAR(100) NULL,
            new_tracking VARCHAR(100) NULL,
            changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            trigger_type VARCHAR(20) NOT NULL COMMENT 'StatusChange, TrackingUpdate, Manual',
            PRIMARY KEY (id),
            KEY idx_order_log_order_id (order_id),
            KEY idx_order_log_changed_at (changed_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");
    echo "Table 'order_status_logs' created/checked.<br>";

    // 2. Drop existing triggers
    $pdo->exec("DROP TRIGGER IF EXISTS trg_order_status_update");
    $pdo->exec("DROP TRIGGER IF EXISTS trg_tracking_insert");
    $pdo->exec("DROP TRIGGER IF EXISTS trg_tracking_update");
    
    // 3. Trigger: Order Status
    // REMOVED: Log logic moved to Application Layer (api/index.php) to support merged logs
    /*
    $pdo->exec("
        CREATE TRIGGER trg_order_status_update
        ...
    ");
    echo "Trigger 'trg_order_status_update' (Orders Table) created.<br>";
    */

    // 4. Trigger: Tracking Insert
    // REMOVED: Log logic moved to Application Layer
    /*
    $pdo->exec("
        CREATE TRIGGER trg_tracking_insert
        ...
    ");
    echo "Trigger 'trg_tracking_insert' (Tracking Table) created.<br>";
    */

    // 5. Trigger: Tracking Update
    // REMOVED: Log logic moved to Application Layer
    /*
    $pdo->exec("
        CREATE TRIGGER trg_tracking_update
        ...
    ");
    echo "Trigger 'trg_tracking_update' (Tracking Table) created.<br>";
    */

} catch (PDOException $e) {
    echo "<div style='color:red'>Error: " . $e->getMessage() . "</div>";
}
?>
