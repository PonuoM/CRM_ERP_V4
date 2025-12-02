<?php
/**
 * Comprehensive Collation Fix Script
 * 
 * This script fixes ALL collation mismatches in the database by converting
 * all relevant tables to use utf8mb4_unicode_ci consistently.
 * 
 * IMPORTANT: Run this script ONCE to fix all collation issues.
 */

header("Content-Type: text/plain; charset=utf-8");
require_once __DIR__ . "/../config.php";

echo "=== Starting Comprehensive Collation Fix ===\n\n";

try {
    $pdo = db_connect();
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    $charset = "utf8mb4";
    $collation = "utf8mb4_unicode_ci";
    
    echo "Target Charset: {$charset}\n";
    echo "Target Collation: {$collation}\n";
    echo "MySQL Version: " . $pdo->query("SELECT VERSION()")->fetchColumn() . "\n\n";
    
    // List of all tables involved in the Finance Approval reconciliation process
    $tables = [
        // Core order and statement tables
        'orders',
        'bank_account',
        'statement_logs',
        'statement_batchs',
        'statement_reconcile_batches',
        'statement_reconcile_logs'
    ];
    
    echo "Tables to process:\n";
    foreach ($tables as $table) {
        echo "  - $table\n";
    }
    echo "\n";
    
    // STEP 1: Check current collations
    echo "=== Step 1: Checking Current Collations ===\n\n";
    
    $stmt = $pdo->query("
        SELECT TABLE_NAME, CCSA.CHARACTER_SET_NAME, TABLE_COLLATION
        FROM information_schema.`TABLES` T, information_schema.`COLLATION_CHARACTER_SET_APPLICABILITY` CCSA
        WHERE CCSA.collation_name = T.table_collation
          AND T.table_schema = DATABASE()
          AND T.TABLE_NAME IN ('" . implode("','", $tables) . "')
        ORDER BY TABLE_NAME
    ");
    
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $indicator = ($row['TABLE_COLLATION'] !== $collation) ? " ⚠️ NEEDS FIX" : " ✓ OK";
        echo sprintf("%-35s %s%s\n", $row['TABLE_NAME'], $row['TABLE_COLLATION'], $indicator);
    }
    echo "\n";
    
    // STEP 2: Show column-level collations for key string columns
    echo "=== Step 2: Checking Key Column Collations ===\n\n";
    
    $keyColumns = [
        'orders' => ['id'],
        'bank_account' => ['bank', 'bank_number'],
        'statement_reconcile_batches' => ['document_no', 'bank_display_name'],
        'statement_reconcile_logs' => ['order_id']
    ];
    
    foreach ($keyColumns as $table => $columns) {
        $columnList = "'" . implode("','", $columns) . "'";
        $stmt = $pdo->query("
            SELECT TABLE_NAME, COLUMN_NAME, CHARACTER_SET_NAME, COLLATION_NAME
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = '$table'
              AND COLUMN_NAME IN ($columnList)
            ORDER BY COLUMN_NAME
        ");
        
        echo "  Table: $table\n";
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            if ($row['COLLATION_NAME']) {
                $indicator = ($row['COLLATION_NAME'] !== $collation) ? " ⚠️ NEEDS FIX" : " ✓ OK ";
                echo sprintf("    %-30s %s%s\n", 
                    $row['COLUMN_NAME'], 
                    $row['COLLATION_NAME'] ?? 'NULL',
                    $indicator
                );
            }
        }
        echo "\n";
    }
    
    // STEP 3: Drop all foreign keys that might block conversion
    echo "=== Step 3: Dropping Foreign Keys ===\n\n";
    
    $foreignKeys = [
        'statement_reconcile_logs' => [
            'fk_statement_reconcile_order',
            'fk_statement_reconcile_batch',
            'fk_statement_reconcile_statement'
        ],
        'statement_reconcile_batches' => [
            'fk_statement_reconcile_bank'
        ]
    ];
    
    foreach ($foreignKeys as $table => $keys) {
        foreach ($keys as $key) {
            try {
                $pdo->exec("ALTER TABLE `$table` DROP FOREIGN KEY `$key`");
                echo "  ✓ Dropped FK: $table.$key\n";
            } catch (PDOException $e) {
                echo "  ⚠ FK $table.$key not found or already dropped\n";
            }
        }
    }
    echo "\n";
    
    // STEP 4: Convert all tables to utf8mb4_unicode_ci
    echo "=== Step 4: Converting Tables to $collation ===\n\n";
    
    echo "⚠ WARNING: This may take a few moments for large tables...\n\n";
    
    foreach ($tables as $table) {
        try {
            // Check if table exists
            $stmt = $pdo->query("SHOW TABLES LIKE '$table'");
            if ($stmt->rowCount() === 0) {
                echo "  ⚠ Table $table does not exist, skipping\n";
                continue;
            }
            
            echo "  Converting: $table ... ";
            $start = microtime(true);
            
            $pdo->exec("ALTER TABLE `$table` CONVERT TO CHARACTER SET $charset COLLATE $collation");
            
            $duration = round((microtime(true) - $start) * 1000, 2);
            echo "✓ Done ({$duration}ms)\n";
        } catch (PDOException $e) {
            echo "✗ FAILED\n";
            echo "    Error: " . $e->getMessage() . "\n";
        }
    }
    echo "\n";
    
    // STEP 5: Recreate foreign keys
    echo "=== Step 5: Recreating Foreign Keys ===\n\n";
    
    $fkDefinitions = [
        "ALTER TABLE `statement_reconcile_batches` 
         ADD CONSTRAINT `fk_statement_reconcile_bank` 
         FOREIGN KEY (`bank_account_id`) REFERENCES `bank_account`(`id`) 
         ON DELETE SET NULL ON UPDATE NO ACTION",
         
        "ALTER TABLE `statement_reconcile_logs` 
         ADD CONSTRAINT `fk_statement_reconcile_batch` 
         FOREIGN KEY (`batch_id`) REFERENCES `statement_reconcile_batches`(`id`) 
         ON DELETE CASCADE ON UPDATE NO ACTION",
         
        "ALTER TABLE `statement_reconcile_logs` 
         ADD CONSTRAINT `fk_statement_reconcile_statement` 
         FOREIGN KEY (`statement_log_id`) REFERENCES `statement_logs`(`id`) 
         ON DELETE CASCADE ON UPDATE NO ACTION",
         
        "ALTER TABLE `statement_reconcile_logs` 
         ADD CONSTRAINT `fk_statement_reconcile_order` 
         FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) 
         ON DELETE CASCADE ON UPDATE NO ACTION"
    ];
    
    foreach ($fkDefinitions as $idx => $sql) {
        try {
            $pdo->exec($sql);
            echo "  ✓ Recreated FK #" . ($idx + 1) . "\n";
        } catch (PDOException $e) {
            echo "  ⚠ FK #" . ($idx + 1) . " failed: " . $e->getMessage() . "\n";
        }
    }
    echo "\n";
    
    // STEP 6: Verify the fix
    echo "=== Step 6: Verification ===\n\n";
    
    $stmt = $pdo->query("
        SELECT TABLE_NAME, TABLE_COLLATION
        FROM information_schema.`TABLES`
        WHERE table_schema = DATABASE()
          AND TABLE_NAME IN ('" . implode("','", $tables) . "')
        ORDER BY TABLE_NAME
    ");
    
    $allCorrect = true;
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $isCorrect = ($row['TABLE_COLLATION'] === $collation);
        $indicator = $isCorrect ? " ✓ " : " ✗ ";
        echo sprintf("%s %-35s %s\n", $indicator, $row['TABLE_NAME'], $row['TABLE_COLLATION']);
        if (!$isCorrect) {
            $allCorrect = false;
        }
    }
    
    echo "\n";
    
    // Check key columns again
    echo "Key columns:\n";
    foreach ($keyColumns as $table => $columns) {
        $columnList = "'" . implode("','", $columns) . "'";
        $stmt = $pdo->query("
            SELECT TABLE_NAME, COLUMN_NAME, COLLATION_NAME
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = '$table'
              AND COLUMN_NAME IN ($columnList)
            ORDER BY COLUMN_NAME
        ");
        
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            if ($row['COLLATION_NAME']) {
                $isCorrect = ($row['COLLATION_NAME'] === $collation);
                $indicator = $isCorrect ? " ✓ " : " ✗ ";
                echo sprintf("%s   %-30s %s.%s\n", 
                    $indicator,
                    $row['COLLATION_NAME'],
                    $row['TABLE_NAME'],
                    $row['COLUMN_NAME']
                );
                if (!$isCorrect) {
                    $allCorrect = false;
                }
            }
        }
    }
    
    echo "\n=== Final Result ===\n\n";
    
    if ($allCorrect) {
        echo "✓✓✓ SUCCESS! All tables and columns are now using $collation ✓✓✓\n\n";
        echo "You can now test the Finance Approval page at:\n";
        echo "http://localhost:5173/?page=Finance+Approval\n\n";
    } else {
        echo "✗ WARNING: Some tables/columns still have incorrect collations.\n";
        echo "Please review the output above and manually fix any remaining issues.\n\n";
    }
    
} catch (Exception $e) {
    echo "\n✗✗✗ FATAL ERROR ✗✗✗\n\n";
    echo "Error: " . $e->getMessage() . "\n";
    echo "Trace: " . $e->getTraceAsString() . "\n";
}

echo "\n=== Script Complete ===\n";
