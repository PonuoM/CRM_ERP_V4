<?php
require_once __DIR__ . '/../config.php';

$pdo = db_connect();

echo "<h2>Migrating google_sheet_shipping table...</h2>";

try {
    // Check if column exists
    $stmt = $pdo->query("SHOW COLUMNS FROM google_sheet_shipping LIKE 'order_status'");
    $column = $stmt->fetch();

    if (!$column) {
        $pdo->exec("ALTER TABLE google_sheet_shipping ADD COLUMN order_status VARCHAR(50) NULL COMMENT 'สถานะคำสั่งซื้อ (Official)' AFTER order_number");
        $pdo->exec("ALTER TABLE google_sheet_shipping ADD INDEX idx_order_status (order_status)");
        echo "Added column 'order_status' successfully.<br>";
    } else {
        echo "Column 'order_status' already exists.<br>";
    }

} catch (PDOException $e) {
    echo "<div style='color:red'>Error: " . $e->getMessage() . "</div>";
}
?>
