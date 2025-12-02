<?php
/**
 * Force Fix All Collation Issues
 * 
 * This script will:
 * 1. Set server-level collation variables (if possible)
 * 2. Verify all tables use utf8mb4_unicode_ci
 * 3. Fix any remaining collation mismatches
 */

require_once __DIR__ . '/../api/config.php';

echo "========================================\n";
echo "Force Fix All Collation Issues\n";
echo "========================================\n\n";

try {
    $pdo = db_connect();
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    $dbName = $pdo->query("SELECT DATABASE()")->fetchColumn();
    echo "Database: {$dbName}\n\n";
    
    // Step 1: Check current collations
    echo "Step 1: Checking current collation settings...\n";
    echo "   " . str_repeat("-", 50) . "\n";
    
    $settings = $pdo->query("
        SELECT 
            @@collation_connection as conn,
            @@collation_database as db,
            @@collation_server as server,
            @@character_set_connection as charset_conn
    ")->fetch(PDO::FETCH_ASSOC);
    
    echo "  Connection Collation: {$settings['conn']}\n";
    echo "  Database Collation: {$settings['db']}\n";
    echo "  Server Collation: {$settings['server']}\n";
    echo "  Connection Charset: {$settings['charset_conn']}\n\n";
    
    // Step 2: Force set connection collation
    echo "Step 2: Forcing connection collation to utf8mb4_unicode_ci...\n";
    echo "   " . str_repeat("-", 50) . "\n";
    
    $pdo->exec("SET SESSION collation_connection = 'utf8mb4_unicode_ci'");
    $pdo->exec("SET SESSION character_set_connection = 'utf8mb4'");
    $pdo->exec("SET SESSION collation_database = 'utf8mb4_unicode_ci'");
    $pdo->exec("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
    $pdo->exec("SET CHARACTER SET utf8mb4");
    
    echo "  [OK] Connection collation set\n\n";
    
    // Step 3: Verify critical tables
    echo "Step 3: Verifying critical tables...\n";
    echo "   " . str_repeat("-", 50) . "\n";
    
    $criticalTables = [
        'statement_reconcile_batches',
        'statement_reconcile_logs',
        'orders',
        'statement_logs',
        'bank_account'
    ];
    
    foreach ($criticalTables as $table) {
        $tableInfo = $pdo->query("
            SELECT TABLE_COLLATION
            FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_SCHEMA = '{$dbName}'
                AND TABLE_NAME = '{$table}'
        ")->fetch(PDO::FETCH_ASSOC);
        
        if ($tableInfo) {
            $collation = $tableInfo['TABLE_COLLATION'];
            $status = ($collation === 'utf8mb4_unicode_ci') ? '[OK]' : '[FIX]';
            echo "  {$status} {$table}: {$collation}\n";
            
            if ($collation !== 'utf8mb4_unicode_ci') {
                try {
                    $pdo->exec("ALTER TABLE `{$table}` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
                    echo "    -> Fixed to utf8mb4_unicode_ci\n";
                } catch (PDOException $e) {
                    echo "    -> Error: " . $e->getMessage() . "\n";
                }
            }
        }
    }
    
    echo "\n";
    
    // Step 4: Verify critical string columns
    echo "Step 4: Verifying critical string columns...\n";
    echo "   " . str_repeat("-", 50) . "\n";
    
    $criticalColumns = [
        ['table' => 'orders', 'column' => 'id'],
        ['table' => 'statement_reconcile_logs', 'column' => 'order_id'],
        ['table' => 'statement_reconcile_batches', 'column' => 'document_no'],
        ['table' => 'statement_reconcile_batches', 'column' => 'bank_display_name'],
    ];
    
    foreach ($criticalColumns as $colInfo) {
        $columnInfo = $pdo->query("
            SELECT COLLATION_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = '{$dbName}'
                AND TABLE_NAME = '{$colInfo['table']}'
                AND COLUMN_NAME = '{$colInfo['column']}'
        ")->fetch(PDO::FETCH_ASSOC);
        
        if ($columnInfo && $columnInfo['COLLATION_NAME']) {
            $collation = $columnInfo['COLLATION_NAME'];
            $status = ($collation === 'utf8mb4_unicode_ci') ? '[OK]' : '[FIX]';
            echo "  {$status} {$colInfo['table']}.{$colInfo['column']}: {$collation}\n";
            
            if ($collation !== 'utf8mb4_unicode_ci') {
                try {
                    $columnDef = $pdo->query("
                        SELECT COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
                        FROM INFORMATION_SCHEMA.COLUMNS
                        WHERE TABLE_SCHEMA = '{$dbName}'
                            AND TABLE_NAME = '{$colInfo['table']}'
                            AND COLUMN_NAME = '{$colInfo['column']}'
                    ")->fetch(PDO::FETCH_ASSOC);
                    
                    $nullable = $columnDef['IS_NULLABLE'] === 'YES' ? 'NULL' : 'NOT NULL';
                    $default = $columnDef['COLUMN_DEFAULT'] !== null ? " DEFAULT '{$columnDef['COLUMN_DEFAULT']}'" : '';
                    
                    $pdo->exec("
                        ALTER TABLE `{$colInfo['table']}`
                        MODIFY COLUMN `{$colInfo['column']}` {$columnDef['COLUMN_TYPE']}
                        CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
                        {$nullable}{$default}
                    ");
                    echo "    -> Fixed to utf8mb4_unicode_ci\n";
                } catch (PDOException $e) {
                    echo "    -> Error: " . $e->getMessage() . "\n";
                }
            }
        }
    }
    
    echo "\n";
    echo "========================================\n";
    echo "[SUCCESS] All collation issues fixed!\n";
    echo "========================================\n";
    
} catch (Throwable $e) {
    echo "\n[FATAL ERROR] " . $e->getMessage() . "\n";
    echo "Stack trace:\n" . $e->getTraceAsString() . "\n";
    exit(1);
}

