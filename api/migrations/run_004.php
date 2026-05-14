<?php
require_once __DIR__ . '/../config.php';
try {
    $pdo = db_connect();
    $sql = file_get_contents(__DIR__ . '/004_add_basket_config_sales_extension.sql');
    $pdo->exec($sql);
    echo "Migration 004 successful.";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
