<?php
/**
 * Verify Collation Alignment for Statement Reconcile Tables
 * 
 * This script checks if collations are properly aligned between:
 * - bank_account.bank <-> statement_reconcile_batches.bank_display_name
 * - orders.id <-> statement_reconcile_logs.order_id
 */

require_once __DIR__ . '/../api/config.php';

try {
    echo "========================================\n";
    echo "Collation Alignment Verification\n";
    echo "========================================\n\n";
    
    $pdo = db_connect();
    
    // Check bank_display_name collation
    echo "1. Checking bank_display_name collation alignment:\n";
    echo "   " . str_repeat("-", 50) . "\n";
    
    $bankCollation = $pdo->query("
        SELECT COLLATION_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'bank_account' 
          AND COLUMN_NAME = 'bank'
        LIMIT 1
    ")->fetchColumn();
    
    $batchBankCollation = $pdo->query("
        SELECT COLLATION_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'statement_reconcile_batches' 
          AND COLUMN_NAME = 'bank_display_name'
        LIMIT 1
    ")->fetchColumn();
    
    echo "   Source (bank_account.bank):         " . ($bankCollation ?: "NOT FOUND") . "\n";
    echo "   Target (statement_reconcile_batches.bank_display_name): " . ($batchBankCollation ?: "NOT FOUND") . "\n";
    
    if ($bankCollation && $batchBankCollation && $bankCollation === $batchBankCollation) {
        echo "   Status: ✅ ALIGNED\n\n";
    } else {
        echo "   Status: ❌ MISMATCH\n";
        echo "   Action: Run migration script to fix\n\n";
    }
    
    // Check order_id collation
    echo "2. Checking order_id collation alignment:\n";
    echo "   " . str_repeat("-", 50) . "\n";
    
    $ordersCollation = $pdo->query("
        SELECT COLLATION_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'orders' 
          AND COLUMN_NAME = 'id'
        LIMIT 1
    ")->fetchColumn();
    
    $logOrderCollation = $pdo->query("
        SELECT COLLATION_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'statement_reconcile_logs' 
          AND COLUMN_NAME = 'order_id'
        LIMIT 1
    ")->fetchColumn();
    
    echo "   Source (orders.id):                 " . ($ordersCollation ?: "NOT FOUND") . "\n";
    echo "   Target (statement_reconcile_logs.order_id): " . ($logOrderCollation ?: "NOT FOUND") . "\n";
    
    if ($ordersCollation && $logOrderCollation && $ordersCollation === $logOrderCollation) {
        echo "   Status: ✅ ALIGNED\n\n";
    } else {
        echo "   Status: ❌ MISMATCH\n";
        echo "   Action: Run migration script to fix\n\n";
    }
    
    // Summary
    echo "========================================\n";
    $allAligned = ($bankCollation === $batchBankCollation) && ($ordersCollation === $logOrderCollation);
    
    if ($allAligned) {
        echo "✅ ALL COLLATIONS ARE PROPERLY ALIGNED\n";
        echo "   No action needed. The database is ready.\n";
    } else {
        echo "❌ COLLATION MISMATCH DETECTED\n";
        echo "   Please run: migrations/20250131_fix_statement_reconcile_collations.sql\n";
        echo "   Or the collation will be fixed automatically on next API call.\n";
    }
    echo "========================================\n";
    
} catch (Throwable $e) {
    echo "Error: " . $e->getMessage() . "\n";
    echo "Stack trace:\n" . $e->getTraceAsString() . "\n";
    exit(1);
}

