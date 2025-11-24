<?php
require_once __DIR__ . '/../api/config.php';

try {
    $pdo = db_connect();
    $stmt = $pdo->prepare("SHOW CREATE TABLE orders");
    $stmt->execute();
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    echo $row['Create Table'] . "\n";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
