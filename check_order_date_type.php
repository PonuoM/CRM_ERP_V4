<?php
require_once 'api/config.php';

try {
    $pdo = db_connect();
    $stmt = $pdo->query("SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT 
                         FROM INFORMATION_SCHEMA.COLUMNS 
                         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'order_date'");
    $col = $stmt->fetch(PDO::FETCH_ASSOC);
    var_dump($col);
} catch (Throwable $e) {
    echo "Error: " . $e->getMessage();
}
