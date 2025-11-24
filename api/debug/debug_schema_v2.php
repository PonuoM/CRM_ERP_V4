<?php
require_once __DIR__ . '/config.php';

try {
    $pdo = db_connect();
    $tables = ['customers', 'orders', 'customer_tags'];
    foreach ($tables as $table) {
        echo "Table: $table\n";
        $stmt = $pdo->query("DESCRIBE $table");
        $columns = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($columns as $col) {
            echo "  " . $col['Field'] . " (" . $col['Type'] . ")\n";
        }
        echo "\n";
    }
} catch (Throwable $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
