<?php
/**
 * Quick Collation Verification Script
 * Tests if the collation fix resolved the issue
 */

header("Content-Type: text/plain; charset=utf-8");
require_once __DIR__ . "/../config.php";

echo "=== Testing Collation Fix ===\n\n";

try {
    $pdo = db_connect();
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    // Set collation (same as in reconcile_save.php)
    $pdo->exec("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
    
    echo "✓ Connected to database\n";
    echo "✓ Collation set to utf8mb4_unicode_ci\n\n";
    
    // Test 1: Check table collations
    echo "Test 1: Checking table collations\n";
    echo "─────────────────────────────────────────\n";
    
    $tables = ['orders', 'statement_reconcile_logs', 'statement_reconcile_batches', 'bank_account'];
    $stmt = $pdo->query("
        SELECT TABLE_NAME, TABLE_COLLATION
        FROM information_schema.TABLES
        WHERE table_schema = DATABASE()
          AND TABLE_NAME IN ('" . implode("','", $tables) . "')
    ");
    
    $allOk = true;
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $ok = ($row['TABLE_COLLATION'] === 'utf8mb4_unicode_ci');
        $status = $ok ? '✓' : '✗';
        echo sprintf("%s %-35s %s\n", $status, $row['TABLE_NAME'], $row['TABLE_COLLATION']);
        if (!$ok) $allOk = false;
    }
    echo "\n";
    
    // Test 2: Simulate the problematic JOIN
    echo "Test 2: Testing JOIN between orders and statement_reconcile_logs\n";
    echo "─────────────────────────────────────────────────────────────────────\n";
    
    try {
        // This is similar to what happens in reconcile_save.php
        $testStmt = $pdo->query("
            SELECT COUNT(*) as cnt 
            FROM orders o
            LEFT JOIN statement_reconcile_logs srl ON o.id = srl.order_id
            LIMIT 1
        ");
        
        $result = $testStmt->fetch(PDO::FETCH_ASSOC);
        echo "✓ JOIN test passed - no collation errors!\n";
        echo "  (Tested with " . $result['cnt'] . " records)\n\n";
        
    } catch (PDOException $e) {
        echo "✗ JOIN test FAILED\n";
        echo "  Error: " . $e->getMessage() . "\n\n";
        $allOk = false;
    }
    
    // Test 3: Check specific columns
    echo "Test 3: Checking critical column collations\n";
    echo "────────────────────────────────────────────────\n";
    
    $criticalColumns = [
        ['orders', 'id'],
        ['statement_reconcile_logs', 'order_id']
    ];
    
    foreach ($criticalColumns as list($table, $column)) {
        $stmt = $pdo->query("
            SELECT COLUMN_NAME, COLLATION_NAME
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = '$table'
              AND COLUMN_NAME = '$column'
        ");
        
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($row && $row['COLLATION_NAME']) {
            $ok = ($row['COLLATION_NAME'] === 'utf8mb4_unicode_ci');
            $status = $ok ? '✓' : '✗';
            echo sprintf("%s %-40s %s\n", 
                $status,
                "$table.$column", 
                $row['COLLATION_NAME']
            );
            if (!$ok) $allOk = false;
        }
    }
    
    echo "\n";
    echo "═══════════════════════════════════════\n";
    
    if ($allOk) {
        echo "✓✓✓ ALL TESTS PASSED ✓✓✓\n\n";
        echo "The collation fix was successful!\n";
        echo "You can now use Finance Approval without errors.\n";
    } else {
        echo "✗✗✗ SOME TESTS FAILED ✗✗✗\n\n";
        echo "Please run fix_all_collations.php again.\n";
    }
    
} catch (Exception $e) {
    echo "\n✗ ERROR: " . $e->getMessage() . "\n";
}

echo "\n";
