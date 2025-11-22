<?php
require_once __DIR__ . '/config.php';

try {
    $pdo = db_connect();
    $tables = ['activities', 'appointments', 'call_history', 'customer_assignment_history'];
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
