<?php
require_once __DIR__ . '/config.php';

header('Content-Type: text/plain; charset=utf-8');

function getEnumDefinition($pdo, $table, $column) {
    try {
        $stmt = $pdo->query("SHOW COLUMNS FROM `$table` LIKE '$column'");
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ? $row['Type'] : "Column not found";
    } catch (Exception $e) {
        return "Error: " . $e->getMessage();
    }
}

try {
    $pdo = db_connect();
    
    echo "--- DIAGNOSTIC START ---\n";
    
    // 1. Check current Orders table schema
    $currentOrdersEnum = getEnumDefinition($pdo, 'orders', 'payment_method');
    echo "Current 'orders.payment_method' type: " . $currentOrdersEnum . "\n";
    
    // 2. Check current Order_Boxes table schema
    $currentBoxesEnum = getEnumDefinition($pdo, 'order_boxes', 'payment_method');
    echo "Current 'order_boxes.payment_method' type: " . $currentBoxesEnum . "\n";
    
    // 3. Attempt Fix
    echo "\nAttempting to update schemas...\n";
    
    try {
        $sql1 = "ALTER TABLE orders MODIFY COLUMN payment_method ENUM('COD', 'Transfer', 'PayAfter', 'Claim', 'FreeGift') DEFAULT NULL";
        $pdo->exec($sql1);
        echo "Executed: ALTER TABLE orders ...\n";
    } catch (Exception $e) {
        echo "Failed to alter orders: " . $e->getMessage() . "\n";
    }

    try {
        $sql2 = "ALTER TABLE order_boxes MODIFY COLUMN payment_method ENUM('COD', 'Transfer', 'PayAfter', 'Claim', 'FreeGift') DEFAULT 'COD'";
        $pdo->exec($sql2);
        echo "Executed: ALTER TABLE order_boxes ...\n";
    } catch (Exception $e) {
        echo "Failed to alter order_boxes: " . $e->getMessage() . "\n";
    }

    // 4. Verify again
    echo "\n--- VERIFICATION ---\n";
    echo "New 'orders.payment_method' type: " . getEnumDefinition($pdo, 'orders', 'payment_method') . "\n";
    echo "New 'order_boxes.payment_method' type: " . getEnumDefinition($pdo, 'order_boxes', 'payment_method') . "\n";
    
    if (strpos(getEnumDefinition($pdo, 'orders', 'payment_method'), 'Claim') !== false) {
        echo "\nSUCCESS: Database is correctly configured.\n";
    } else {
        echo "\nFAILURE: Database update failed. Please check permissions or locking.\n";
    }
    
    echo "--- DIAGNOSTIC END ---\n";
    
} catch (Throwable $e) {
    echo "CRITICAL ERROR: " . $e->getMessage();
}
