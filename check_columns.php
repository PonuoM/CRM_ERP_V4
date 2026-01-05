<?php
require_once __DIR__ . '/api/config.php';

try {
    $pdo = db_connect();
    
    echo "--- All Columns in customers ---\n";
    $stmt = $pdo->query("SHOW COLUMNS FROM customers");
    $columns = $stmt->fetchAll(PDO::FETCH_ASSOC);
    print_r($columns);

} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
