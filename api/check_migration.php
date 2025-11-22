<?php
require_once __DIR__ . '/config.php';

try {
    $pdo = db_connect();
    $stmt = $pdo->query("SHOW COLUMNS FROM orders LIKE 'customer_ref_id'");
    $col = $stmt->fetch();
    if ($col) {
        echo "Column customer_ref_id EXISTS in orders table.\n";
        echo "Migration has NOT been run yet.\n";
    } else {
        echo "Column customer_ref_id DOES NOT EXIST in orders table.\n";
        echo "Migration MIGHT HAVE been run.\n";
    }
} catch (Throwable $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
