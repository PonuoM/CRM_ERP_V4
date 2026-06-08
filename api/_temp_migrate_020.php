<?php
require_once __DIR__ . '/config.php';
try {
    $pdo = db_connect();
    $sql = file_get_contents(__DIR__ . '/migrations/020_create_jst_inventory_table.sql');
    $pdo->exec($sql);
    echo "Migration 020 successful";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
