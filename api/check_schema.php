<?php
header('Content-Type: application/json');
require_once 'config.php';

$tables = ['product_lots', 'warehouse_stocks', 'products', 'warehouses', 'activities'];
$result = [];

try {
    // List all tables
    $allTables = $pdo->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN);
    $result['all_tables'] = $allTables;

    foreach ($tables as $table) {
        if (in_array($table, $allTables)) {
            $stmt = $pdo->query("DESCRIBE `$table`");
            $result[$table] = $stmt->fetchAll(PDO::FETCH_ASSOC);
        } else {
            $result[$table] = 'Not Found';
        }
    }
} catch (PDOException $e) {
    $result['error'] = $e->getMessage();
}

echo json_encode($result, JSON_PRETTY_PRINT);
