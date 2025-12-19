<?php
require_once __DIR__ . '/config.php';
try {
    $pdo = db_connect();
    $stmt = $pdo->query("DESCRIBE orders payment_method");
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    echo "Column Type: " . $row['Type'] . "\n";
} catch (Throwable $e) {
    echo "Error: " . $e->getMessage();
}
