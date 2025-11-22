<?php
require_once __DIR__ . '/config.php';

try {
    $pdo = db_connect();
    $tables = ['appointments', 'call_history', 'customer_assignment_history'];
    foreach ($tables as $table) {
        echo "Table: $table\n";
        $stmt = $pdo->query("DESCRIBE $table");
        $columns = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $hasRef = false;
        foreach ($columns as $col) {
            if ($col['Field'] === 'customer_ref_id') $hasRef = true;
        }
        echo "  customer_ref_id: " . ($hasRef ? "EXISTS" : "MISSING") . "\n";
    }
} catch (Throwable $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
