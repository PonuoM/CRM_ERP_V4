<?php
/**
 * Check orders table id column collation specifically
 */

header("Content-Type: text/plain; charset=utf-8");
require_once "../config.php";

echo "=== Checking Orders Table ID Column ===\n\n";

try {
    $pdo = db_connect();
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    // Check orders.id column
    $result = $pdo->query("
        SELECT 
            COLUMN_NAME,
            DATA_TYPE,
            CHARACTER_SET_NAME,
            COLLATION_NAME,
            COLUMN_TYPE
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'orders'
          AND COLUMN_NAME = 'id'
    ")->fetch(PDO::FETCH_ASSOC);
    
    echo "orders.id column:\n";
    echo "  Data Type: " . $result['DATA_TYPE'] . "\n";
    echo "  Column Type: " . $result['COLUMN_TYPE'] . "\n";
    echo "  Charset: " . ($result['CHARACTER_SET_NAME'] ?? 'NULL') . "\n";
    echo "  Collation: " . ($result['COLLATION_NAME'] ?? 'NULL') . "\n\n";
    
    // Check statement_reconcile_logs.order_id column
    $result2 = $pdo->query("
        SELECT 
            COLUMN_NAME,
            DATA_TYPE,
            CHARACTER_SET_NAME,
            COLLATION_NAME,
            COLUMN_TYPE
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'statement_reconcile_logs'
          AND COLUMN_NAME = 'order_id'
    ")->fetch(PDO::FETCH_ASSOC);
    
    echo "statement_reconcile_logs.order_id column:\n";
    echo "  Data Type: " . $result2['DATA_TYPE'] . "\n";
    echo "  Column Type: " . $result2['COLUMN_TYPE'] . "\n";
    echo "  Charset: " . ($result2['CHARACTER_SET_NAME'] ?? 'NULL') . "\n";
    echo "  Collation: " . ($result2['COLLATION_NAME'] ?? 'NULL') . "\n\n";
    
    // Test if they match
    if ($result['COLLATION_NAME'] && $result2['COLLATION_NAME']) {
        if ($result['COLLATION_NAME'] === $result2['COLLATION_NAME']) {
            echo "✓ Collations MATCH\n";
        } else {
            echo "✗ Collations DO NOT MATCH!\n";
            echo "  orders.id: " . $result['COLLATION_NAME'] . "\n";
            echo "  statement_reconcile_logs.order_id: " . $result2['COLLATION_NAME'] . "\n";
        }
    }
    
    // Show actual error from database
    echo "\n=== Testing Actual Comparison ===\n\n";
    
    // Try to get a sample order_id
    $sampleOrder = $pdo->query("SELECT id FROM orders LIMIT 1")->fetchColumn();
    
    if ($sampleOrder) {
        echo "Sample order ID: $sampleOrder\n\n";
        
        // Try problematic comparison
        try {
            $stmt = $pdo->prepare("
                SELECT id FROM orders 
                WHERE id = :orderId
            ");
            $stmt->execute([':orderId' => $sampleOrder]);
            echo "✓ Basic comparison works\n";
        } catch (PDOException $e) {
            echo "✗ Basic comparison FAILED: " . $e->getMessage() . "\n";
        }
    }
    
} catch (Exception $e) {
    echo "\n✗✗✗ ERROR ✗✗✗\n";
    echo $e->getMessage() . "\n";
}
