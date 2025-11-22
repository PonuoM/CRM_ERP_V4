<?php
require_once __DIR__ . '/config.php';

try {
    $pdo = db_connect();
    echo "Table: customers\n";
    $stmt = $pdo->query("DESCRIBE customers");
    $columns = $stmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($columns as $col) {
        echo "  " . $col['Field'] . " (" . $col['Type'] . ") " . $col['Key'] . "\n";
    }
} catch (Throwable $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
