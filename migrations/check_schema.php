<?php
require_once __DIR__ . '/../api/config.php';

try {
    $pdo = db_connect();
    $stmt = $pdo->query("DESCRIBE customers");
    $columns = $stmt->fetchAll(PDO::FETCH_COLUMN);
    
    if (in_array('internal_id', $columns) || in_array('customer_code', $columns)) {
        echo "Migration appears to have been run (columns found).\n";
        // Check if id is int
        $stmt = $pdo->query("SHOW COLUMNS FROM customers WHERE Field = 'id'");
        $idCol = $stmt->fetch();
        echo "ID Type: " . $idCol['Type'] . "\n";
    } else {
        echo "Migration NOT run.\n";
    }

} catch (Throwable $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
