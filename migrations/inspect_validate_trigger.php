<?php
require_once __DIR__ . '/../api/config.php';

try {
    $pdo = db_connect();
    $stmt = $pdo->prepare("SHOW CREATE TRIGGER trg_validate_order_creator");
    $stmt->execute();
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    echo "TRIGGER: trg_validate_order_creator\n";
    echo $row['SQL Original Statement'] . "\n";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
