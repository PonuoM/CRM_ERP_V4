<?php
require_once __DIR__ . '/config.php';

try {
    $pdo = db_connect();
    echo "Table: activities\n";
    $stmt = $pdo->query("DESCRIBE activities");
    $columns = $stmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($columns as $col) {
        echo "  " . $col['Field'] . " (" . $col['Type'] . ")\n";
    }
} catch (Throwable $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
