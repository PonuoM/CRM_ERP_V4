<?php
/**
 * Test Reconcile Insert - ตรวจสอบว่าสามารถ INSERT ได้หรือไม่
 */

require_once __DIR__ . '/../api/config.php';

echo "========================================\n";
echo "Test Reconcile Insert\n";
echo "========================================\n\n";

try {
    $pdo = db_connect();
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    // Set connection collation
    $pdo->exec("SET SESSION collation_connection = 'utf8mb4_unicode_ci'");
    $pdo->exec("SET SESSION character_set_connection = 'utf8mb4'");
    $pdo->exec("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
    $pdo->exec("SET CHARACTER SET utf8mb4");
    
    echo "Step 1: Testing connection collation...\n";
    echo "   " . str_repeat("-", 50) . "\n";
    
    $collation = $pdo->query("SELECT @@collation_connection as coll")->fetch(PDO::FETCH_ASSOC);
    echo "  Connection Collation: {$collation['coll']}\n\n";
    
    if ($collation['coll'] !== 'utf8mb4_unicode_ci') {
        echo "  [ERROR] Connection collation is not utf8mb4_unicode_ci!\n";
        exit(1);
    }
    
    echo "Step 2: Testing string comparison...\n";
    echo "   " . str_repeat("-", 50) . "\n";
    
    // Test: orders.id collation
    $orderCollation = $pdo->query("
        SELECT COLLATION_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'orders'
            AND COLUMN_NAME = 'id'
    ")->fetch(PDO::FETCH_ASSOC);
    
    echo "  orders.id collation: " . ($orderCollation['COLLATION_NAME'] ?? 'NULL') . "\n";
    
    // Test: statement_reconcile_logs.order_id collation
    $logCollation = $pdo->query("
        SELECT COLLATION_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'statement_reconcile_logs'
            AND COLUMN_NAME = 'order_id'
    ")->fetch(PDO::FETCH_ASSOC);
    
    echo "  statement_reconcile_logs.order_id collation: " . ($logCollation['COLLATION_NAME'] ?? 'NULL') . "\n";
    
    if ($orderCollation['COLLATION_NAME'] !== $logCollation['COLLATION_NAME']) {
        echo "  [ERROR] Collations don't match!\n";
        exit(1);
    }
    
    echo "\nStep 3: Testing INSERT with CAST...\n";
    echo "   " . str_repeat("-", 50) . "\n";
    
    // Get a sample order_id
    $sampleOrder = $pdo->query("SELECT id FROM orders LIMIT 1")->fetch(PDO::FETCH_ASSOC);
    
    if (!$sampleOrder) {
        echo "  [SKIP] No orders found to test\n";
        exit(0);
    }
    
    $testOrderId = $sampleOrder['id'];
    echo "  Test Order ID: {$testOrderId}\n";
    
    // Test: Can we compare order_id with CAST?
    try {
        $testQuery = $pdo->prepare("
            SELECT COUNT(*) as cnt
            FROM orders
            WHERE id COLLATE utf8mb4_unicode_ci = CAST(:orderId AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci
        ");
        $testQuery->execute([':orderId' => $testOrderId]);
        $result = $testQuery->fetch(PDO::FETCH_ASSOC);
        
        if ($result['cnt'] > 0) {
            echo "  [OK] String comparison works!\n";
        } else {
            echo "  [ERROR] String comparison failed!\n";
            exit(1);
        }
    } catch (PDOException $e) {
        echo "  [ERROR] String comparison failed: " . $e->getMessage() . "\n";
        exit(1);
    }
    
    echo "\nStep 4: Testing INSERT syntax (dry run)...\n";
    echo "   " . str_repeat("-", 50) . "\n";
    
    // Check if we have a batch to test with
    $batchExists = $pdo->query("SELECT COUNT(*) as cnt FROM statement_reconcile_batches LIMIT 1")->fetch(PDO::FETCH_ASSOC);
    
    if ($batchExists['cnt'] > 0) {
        $testBatchId = $pdo->query("SELECT id FROM statement_reconcile_batches LIMIT 1")->fetchColumn();
        
        // Try to prepare the INSERT statement
        try {
            $testInsert = $pdo->prepare("
                INSERT INTO statement_reconcile_logs
                  (batch_id, statement_log_id, order_id, statement_amount, confirmed_amount, auto_matched)
                VALUES
                  (:batchId, :statementId, CAST(:orderId AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci, :statementAmount, :confirmedAmount, :autoMatched)
            ");
            
            echo "  [OK] INSERT statement prepared successfully!\n";
            echo "  Note: Not actually inserting data (dry run)\n";
        } catch (PDOException $e) {
            echo "  [ERROR] INSERT statement preparation failed: " . $e->getMessage() . "\n";
            exit(1);
        }
    } else {
        echo "  [SKIP] No batches found to test with\n";
    }
    
    echo "\n";
    echo "========================================\n";
    echo "[SUCCESS] All tests passed!\n";
    echo "========================================\n";
    
} catch (Throwable $e) {
    echo "\n[FATAL ERROR] " . $e->getMessage() . "\n";
    echo "Stack trace:\n" . $e->getTraceAsString() . "\n";
    exit(1);
}

