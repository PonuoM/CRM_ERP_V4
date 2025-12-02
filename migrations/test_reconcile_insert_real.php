<?php
/**
 * Test Real Reconcile Insert - ทดสอบ INSERT จริงๆ
 */

require_once __DIR__ . '/../api/config.php';

echo "========================================\n";
echo "Test Real Reconcile Insert\n";
echo "========================================\n\n";

try {
    $pdo = db_connect();
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    // Set connection collation
    $pdo->exec("SET SESSION collation_connection = 'utf8mb4_unicode_ci'");
    $pdo->exec("SET SESSION character_set_connection = 'utf8mb4'");
    $pdo->exec("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
    $pdo->exec("SET CHARACTER SET utf8mb4");
    
    $dbName = $pdo->query("SELECT DATABASE()")->fetchColumn();
    echo "Database: {$dbName}\n";
    echo "Connection Collation: " . $pdo->query("SELECT @@collation_connection")->fetchColumn() . "\n\n";
    
    // Get sample data
    echo "Step 1: Getting sample data...\n";
    echo "   " . str_repeat("-", 50) . "\n";
    
    $sampleOrder = $pdo->query("
        SELECT id, company_id 
        FROM orders 
        WHERE payment_method = 'Transfer'
        LIMIT 1
    ")->fetch(PDO::FETCH_ASSOC);
    
    if (!$sampleOrder) {
        echo "  [ERROR] No Transfer orders found!\n";
        exit(1);
    }
    
    $sampleStatement = $pdo->query("
        SELECT sl.id, sl.amount, sl.bank_account_id, sb.company_id
        FROM statement_logs sl
        INNER JOIN statement_batchs sb ON sb.id = sl.batch_id
        WHERE sb.company_id = {$sampleOrder['company_id']}
        LIMIT 1
    ")->fetch(PDO::FETCH_ASSOC);
    
    if (!$sampleStatement) {
        echo "  [ERROR] No statements found for company {$sampleOrder['company_id']}!\n";
        exit(1);
    }
    
    $bankAccountId = $sampleStatement['bank_account_id'];
    $companyId = $sampleOrder['company_id'];
    $orderId = $sampleOrder['id'];
    $statementId = $sampleStatement['id'];
    
    echo "  Order ID: {$orderId}\n";
    echo "  Statement ID: {$statementId}\n";
    echo "  Company ID: {$companyId}\n";
    echo "  Bank Account ID: {$bankAccountId}\n\n";
    
    // Check collations
    echo "Step 2: Checking collations...\n";
    echo "   " . str_repeat("-", 50) . "\n";
    
    $orderCollation = $pdo->query("
        SELECT COLLATION_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = '{$dbName}'
            AND TABLE_NAME = 'orders'
            AND COLUMN_NAME = 'id'
    ")->fetchColumn();
    
    $logCollation = $pdo->query("
        SELECT COLLATION_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = '{$dbName}'
            AND TABLE_NAME = 'statement_reconcile_logs'
            AND COLUMN_NAME = 'order_id'
    ")->fetchColumn();
    
    echo "  orders.id: {$orderCollation}\n";
    echo "  statement_reconcile_logs.order_id: {$logCollation}\n";
    
    if ($orderCollation !== $logCollation) {
        echo "  [ERROR] Collations don't match!\n";
        exit(1);
    }
    
    echo "  [OK] Collations match!\n\n";
    
    // Test INSERT with CAST
    echo "Step 3: Testing INSERT with CAST...\n";
    echo "   " . str_repeat("-", 50) . "\n";
    
    $pdo->beginTransaction();
    
    try {
        // First create a test batch
        $testDocNo = "TEST-" . date("YmdHis");
        $pdo->exec("
            INSERT INTO statement_reconcile_batches
              (document_no, bank_account_id, bank_display_name, company_id, start_date, end_date, created_by)
            VALUES
              (CAST('{$testDocNo}' AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci, 
               {$bankAccountId}, 
               CAST('TEST BANK' AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci, 
               {$companyId}, 
               NOW(), 
               NOW(), 
               1)
        ");
        $testBatchId = $pdo->lastInsertId();
        echo "  [OK] Created test batch ID: {$testBatchId}\n";
        
        // Test INSERT statement_reconcile_logs
        $testInsert = $pdo->prepare("
            INSERT INTO statement_reconcile_logs
              (batch_id, statement_log_id, order_id, statement_amount, confirmed_amount, auto_matched)
            VALUES
              (:batchId, :statementId, CAST(:orderId AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci, :statementAmount, :confirmedAmount, :autoMatched)
        ");
        
        $testInsert->execute([
            ':batchId' => $testBatchId,
            ':statementId' => $statementId,
            ':orderId' => $orderId,
            ':statementAmount' => 100.00,
            ':confirmedAmount' => 100.00,
            ':autoMatched' => 0
        ]);
        
        echo "  [OK] INSERT statement_reconcile_logs successful!\n";
        
        // Rollback test transaction
        $pdo->rollBack();
        echo "  [OK] Rolled back test transaction\n";
        
    } catch (PDOException $e) {
        $pdo->rollBack();
        echo "  [ERROR] INSERT failed: " . $e->getMessage() . "\n";
        echo "  SQL State: " . $e->getCode() . "\n";
        exit(1);
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


