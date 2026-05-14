<?php
require_once __DIR__ . '/../config.php';

try {
    $pdo = db_connect();
    $sql = file_get_contents(__DIR__ . '/005_add_customer_basket_sales.sql');
    $pdo->exec($sql);
    echo "Migration 005 applied successfully.";
} catch (Exception $e) {
    echo "Migration failed: " . $e->getMessage();
}
