<?php
require_once __DIR__ . "/../config.php";

try {
    $pdo = db_connect();
    $stmt = $pdo->query("DESCRIBE statement_reconcile_logs");
    $columns = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "Columns in statement_reconcile_logs:\n";
    foreach ($columns as $col) {
        echo $col['Field'] . " (" . $col['Type'] . ")\n";
    }
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
?>
