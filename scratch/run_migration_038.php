<?php
require_once __DIR__ . '/../api/config.php';
try {
    $pdo = db_connect();
    $sql = file_get_contents(__DIR__ . '/../api/migrations/038_create_system_updates.sql');
    $pdo->exec($sql);
    echo "SUCCESS";
} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage();
}
