<?php
require_once '../config.php';

try {
    $stmt = $pdo->query("DESCRIBE product_lots");
    $columns = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo "Columns in product_lots:\n";
    foreach ($columns as $col) {
        echo $col['Field'] . " (" . $col['Type'] . ")\n";
    }
} catch (PDOException $e) {
    echo "Error: " . $e->getMessage();
}
?>
