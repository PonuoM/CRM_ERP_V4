<?php
require_once __DIR__ . '/config.php';

try {
    $pdo = db_connect();
    $stmt = $pdo->query("SELECT id, customer_id, customer_ref_id FROM orders LIMIT 5");
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode($rows, JSON_PRETTY_PRINT);
} catch (Throwable $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
