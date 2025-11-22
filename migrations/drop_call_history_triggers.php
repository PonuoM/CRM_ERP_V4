<?php
require_once __DIR__ . '/../api/config.php';

try {
    $pdo = db_connect();
    echo "Dropping call_history triggers...\n";
    $pdo->exec("DROP TRIGGER IF EXISTS call_history_customer_ref_bi");
    $pdo->exec("DROP TRIGGER IF EXISTS call_history_customer_ref_bu");
    echo "Done.\n";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
