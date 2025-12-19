<?php
require_once __DIR__ . '/config.php';

function getEnumOptions($pdo) {
    try {
        $stmt = $pdo->query("SHOW COLUMNS FROM orders LIKE 'payment_method'");
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row['Type'];
    } catch (Exception $e) {
        return "Error: " . $e->getMessage();
    }
}

try {
    $pdo = db_connect();
    echo "Current definition: " . getEnumOptions($pdo) . "\n";
    
    $sql = "ALTER TABLE orders MODIFY COLUMN payment_method ENUM('COD', 'Transfer', 'PayAfter', 'Claim', 'FreeGift') DEFAULT NULL";
    echo "Executing: $sql\n";
    $pdo->exec($sql);
    
    echo "New definition: " . getEnumOptions($pdo) . "\n";
    echo "Migration applied successfully.\n";
} catch (Throwable $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
