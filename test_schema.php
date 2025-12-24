<?php
require_once __DIR__ . '/api/config.php';

try {
    $pdo = db_connect();
    $stmt = $pdo->query("DESCRIBE products");
    $columns = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo "Columns in products table:\n";
    foreach ($columns as $col) {
        echo $col['Field'] . " (" . $col['Type'] . ")\n";
    }
} catch (Throwable $e) {
    echo "Error: " . $e->getMessage();
}
?>
