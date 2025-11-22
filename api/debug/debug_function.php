<?php
require_once __DIR__ . '/config.php';

try {
    $pdo = db_connect();
    
    echo "=== FUNCTION: generate_customer_id ===\n";
    $stmt = $pdo->query("SHOW CREATE FUNCTION generate_customer_id");
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    echo $row['Create Function'] . "\n";

} catch (Throwable $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
