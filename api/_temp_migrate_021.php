<?php
require_once __DIR__ . '/config.php';
try {
    $pdo = db_connect();
    $sql = file_get_contents(__DIR__ . '/migrations/021_add_extended_jst_inventory_fields.sql');
    $pdo->exec($sql);
    echo "Migration 021 successful";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
