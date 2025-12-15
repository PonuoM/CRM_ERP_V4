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
    $pdo->exec("
        CREATE TRIGGER trg_order_status_update
        AFTER UPDATE ON orders
        FOR EACH ROW
        BEGIN
            IF NOT (NEW.order_status <=> OLD.order_status) THEN
                INSERT INTO order_status_logs (order_id, previous_status, new_status, trigger_type, changed_at)
                VALUES (NEW.id, OLD.order_status, NEW.order_status, 'StatusChange', NOW());
            END IF;
        END
    ");
    echo "Trigger 'trg_order_status_update' (Orders Table) created.<br>";

    // 4. Trigger: Tracking Insert
    $pdo->exec("
        CREATE TRIGGER trg_tracking_insert
        AFTER INSERT ON order_tracking_numbers
        FOR EACH ROW
        BEGIN
            INSERT INTO order_status_logs (order_id, new_tracking, trigger_type, changed_at)
            VALUES (NEW.parent_order_id, NEW.tracking_number, 'TrackingUpdate', NOW());
        END
    ");
    echo "Trigger 'trg_tracking_insert' (Tracking Table) created.<br>";

    // 5. Trigger: Tracking Update
    $pdo->exec("
        CREATE TRIGGER trg_tracking_update
        AFTER UPDATE ON order_tracking_numbers
        FOR EACH ROW
        BEGIN
            IF NOT (NEW.tracking_number <=> OLD.tracking_number) THEN
                INSERT INTO order_status_logs (order_id, previous_tracking, new_tracking, trigger_type, changed_at)
                VALUES (NEW.parent_order_id, OLD.tracking_number, NEW.tracking_number, 'TrackingUpdate', NOW());
            END IF;
        END
    ");
    echo "Trigger 'trg_tracking_update' (Tracking Table) created.<br>";

} catch (PDOException $e) {
    echo "<div style='color:red'>Error: " . $e->getMessage() . "</div>";
}
?>
