<?php
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/config.php';

try {
    $pdo = db_connect();
    $results = [];

    // 1. Get Table Structure (Columns)
    $stmt = $pdo->query("SHOW FULL COLUMNS FROM customers");
    $results['columns'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // 2. Get Table Status (Auto Increment value, Engine, etc)
    $stmt = $pdo->query("SHOW TABLE STATUS LIKE 'customers'");
    $results['table_status'] = $stmt->fetch(PDO::FETCH_ASSOC);

    // 3. Get Max ID currently in table
    $stmt = $pdo->query("SELECT MAX(customer_id) as max_id, MIN(customer_id) as min_id, COUNT(*) as count FROM customers");
    $results['stats'] = $stmt->fetch(PDO::FETCH_ASSOC);

    // 4. Get Triggers
    $stmt = $pdo->query("SHOW TRIGGERS WHERE `Table` = 'customers'");
    $results['triggers'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode($results, JSON_PRETTY_PRINT);

} catch (Throwable $e) {
    echo json_encode([
        'error' => true,
        'message' => $e->getMessage(),
        'trace' => $e->getTraceAsString()
    ]);
}
