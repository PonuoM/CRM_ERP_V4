<?php
require_once __DIR__ . '/../config.php';
header('Content-Type: text/plain');

try {
    $pdo = db_connect();
    $dbName = $pdo->query("SELECT DATABASE()")->fetchColumn();
    
    echo "Database: $dbName\n\n";

    $tables = ['customers', 'orders'];
    foreach ($tables as $table) {
        echo "Table: $table\n";
        $stmt = $pdo->query("SELECT COLUMN_NAME, DATA_TYPE, COLUMN_KEY, EXTRA FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = '$dbName' AND TABLE_NAME = '$table'");
        $columns = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($columns as $col) {
            echo "  - {$col['COLUMN_NAME']} ({$col['DATA_TYPE']}) {$col['COLUMN_KEY']} {$col['EXTRA']}\n";
        }
        echo "\n";
    }

} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
