<?php
/**
 * Fix Remaining Collations
 * 
 * This script fixes the remaining tables and columns that still use
 * utf8mb4_0900_ai_ci or other collations instead of utf8mb4_unicode_ci
 */

require_once __DIR__ . '/../api/config.php';

echo "========================================\n";
echo "Fix Remaining Collations\n";
echo "========================================\n\n";

try {
    $pdo = db_connect();
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    $dbName = $pdo->query("SELECT DATABASE()")->fetchColumn();
    echo "Database: {$dbName}\n";
    echo "Target Collation: utf8mb4_unicode_ci\n\n";
    
    $targetCollation = 'utf8mb4_unicode_ci';
    $errors = [];
    
    // ========================================================================
    // Step 1: Get all tables that need fixing
    // ========================================================================
    echo "Step 1: Finding tables that need collation fix...\n";
    echo "   " . str_repeat("-", 50) . "\n";
    
    $tablesToFix = $pdo->query("
        SELECT TABLE_NAME
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = '{$dbName}'
            AND TABLE_TYPE = 'BASE TABLE'
            AND TABLE_COLLATION IS NOT NULL
            AND TABLE_COLLATION != '{$targetCollation}'
        ORDER BY TABLE_NAME
    ")->fetchAll(PDO::FETCH_COLUMN);
    
    echo "Found " . count($tablesToFix) . " tables to fix\n";
    
    foreach ($tablesToFix as $tableName) {
        try {
            // Convert table default collation
            $pdo->exec("ALTER TABLE `{$tableName}` CONVERT TO CHARACTER SET utf8mb4 COLLATE {$targetCollation}");
            echo "  [OK] Converted table: {$tableName}\n";
        } catch (PDOException $e) {
            $errors[] = "Table {$tableName}: " . $e->getMessage();
            echo "  [ERROR] Error converting table {$tableName}: " . $e->getMessage() . "\n";
        }
    }
    
    echo "\n";
    
    // ========================================================================
    // Step 2: Fix remaining columns
    // ========================================================================
    echo "Step 2: Fixing remaining columns...\n";
    echo "   " . str_repeat("-", 50) . "\n";
    
    // Get all columns that need fixing
    $columns = $pdo->query("
        SELECT 
            TABLE_NAME,
            COLUMN_NAME,
            COLUMN_TYPE,
            IS_NULLABLE,
            COLUMN_DEFAULT,
            DATA_TYPE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = '{$dbName}'
            AND COLLATION_NAME IS NOT NULL
            AND COLLATION_NAME != '{$targetCollation}'
            AND DATA_TYPE IN ('varchar', 'char', 'text', 'tinytext', 'mediumtext', 'longtext', 'enum', 'set')
        ORDER BY TABLE_NAME, ORDINAL_POSITION
    ")->fetchAll(PDO::FETCH_ASSOC);
    
    echo "Found " . count($columns) . " columns to fix\n";
    
    $fixed = 0;
    foreach ($columns as $col) {
        // Skip view columns (they can't be altered directly)
        $isView = $pdo->query("
            SELECT COUNT(*) 
            FROM INFORMATION_SCHEMA.VIEWS
            WHERE TABLE_SCHEMA = '{$dbName}'
                AND TABLE_NAME = '{$col['TABLE_NAME']}'
        ")->fetchColumn() > 0;
        
        if ($isView) {
            echo "  [SKIP] {$col['TABLE_NAME']}.{$col['COLUMN_NAME']} - View table, will handle separately\n";
            continue;
        }
        
        try {
            $colType = $col['COLUMN_TYPE'];
            $nullable = $col['IS_NULLABLE'] === 'YES' ? 'NULL' : 'NOT NULL';
            $default = '';
            
            if ($col['COLUMN_DEFAULT'] !== null) {
                $defaultVal = $col['COLUMN_DEFAULT'];
                if (is_numeric($defaultVal) || 
                    $defaultVal === 'CURRENT_TIMESTAMP' || 
                    $defaultVal === 'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') {
                    $default = " DEFAULT {$defaultVal}";
                } else {
                    $escapedDefault = str_replace("'", "''", $defaultVal);
                    $default = " DEFAULT '{$escapedDefault}'";
                }
            }
            
            $sql = "ALTER TABLE `{$col['TABLE_NAME']}` 
                    MODIFY COLUMN `{$col['COLUMN_NAME']}` {$colType} 
                    CHARACTER SET utf8mb4 COLLATE {$targetCollation} 
                    {$nullable}{$default}";
            
            $pdo->exec($sql);
            $fixed++;
            
            echo "  [OK] Fixed: {$col['TABLE_NAME']}.{$col['COLUMN_NAME']}\n";
        } catch (PDOException $e) {
            $errors[] = "Column {$col['TABLE_NAME']}.{$col['COLUMN_NAME']}: " . $e->getMessage();
            echo "  [ERROR] {$col['TABLE_NAME']}.{$col['COLUMN_NAME']}: " . $e->getMessage() . "\n";
        }
    }
    
    echo "  Fixed {$fixed} columns\n\n";
    
    // ========================================================================
    // Step 3: Handle views (drop and recreate if needed)
    // ========================================================================
    echo "Step 3: Checking views...\n";
    echo "   " . str_repeat("-", 50) . "\n";
    
    $views = $pdo->query("
        SELECT TABLE_NAME, VIEW_DEFINITION
        FROM INFORMATION_SCHEMA.VIEWS
        WHERE TABLE_SCHEMA = '{$dbName}'
            AND TABLE_NAME LIKE '%_call_overview%'
    ")->fetchAll(PDO::FETCH_ASSOC);
    
    foreach ($views as $view) {
        echo "  [INFO] View found: {$view['TABLE_NAME']}\n";
        echo "         View collations are derived from underlying tables.\n";
        echo "         If underlying tables use utf8mb4_unicode_ci, views will too.\n";
    }
    
    echo "\n";
    
    // ========================================================================
    // Step 4: Verification
    // ========================================================================
    echo "Step 4: Verifying conversion...\n";
    echo "   " . str_repeat("-", 50) . "\n";
    
    $remainingTables = $pdo->query("
        SELECT COUNT(*) 
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = '{$dbName}'
            AND TABLE_TYPE = 'BASE TABLE'
            AND TABLE_COLLATION != '{$targetCollation}'
            AND TABLE_COLLATION IS NOT NULL
    ")->fetchColumn();
    
    $remainingColumns = $pdo->query("
        SELECT COUNT(*) 
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = '{$dbName}'
            AND COLLATION_NAME IS NOT NULL
            AND COLLATION_NAME != '{$targetCollation}'
            AND DATA_TYPE IN ('varchar', 'char', 'text', 'tinytext', 'mediumtext', 'longtext', 'enum', 'set')
    ")->fetchColumn();
    
    echo "  Remaining tables: {$remainingTables}\n";
    echo "  Remaining columns: {$remainingColumns}\n\n";
    
    if ($remainingTables > 0 || $remainingColumns > 0) {
        echo "  [WARN] Some tables/columns still need fixing.\n";
        
        if ($remainingTables > 0) {
            $tables = $pdo->query("
                SELECT TABLE_NAME, TABLE_COLLATION
                FROM INFORMATION_SCHEMA.TABLES
                WHERE TABLE_SCHEMA = '{$dbName}'
                    AND TABLE_TYPE = 'BASE TABLE'
                    AND TABLE_COLLATION != '{$targetCollation}'
                    AND TABLE_COLLATION IS NOT NULL
            ")->fetchAll(PDO::FETCH_ASSOC);
            
            echo "\n  Tables that still need fixing:\n";
            foreach ($tables as $table) {
                echo "    - {$table['TABLE_NAME']}: {$table['TABLE_COLLATION']}\n";
            }
        }
    } else {
        echo "  [SUCCESS] All tables and columns are using utf8mb4_unicode_ci!\n";
    }
    
    echo "\n";
    echo "========================================\n";
    echo "Summary\n";
    echo "========================================\n";
    echo "Tables fixed: " . count($tablesToFix) . "\n";
    echo "Columns fixed: {$fixed}\n";
    echo "Remaining tables: {$remainingTables}\n";
    echo "Remaining columns: {$remainingColumns}\n";
    
    if (count($errors) > 0) {
        echo "\nErrors encountered: " . count($errors) . "\n";
        foreach (array_slice($errors, 0, 5) as $error) {
            echo "  - {$error}\n";
        }
        if (count($errors) > 5) {
            echo "  ... and " . (count($errors) - 5) . " more errors.\n";
        }
    } else {
        echo "\n[SUCCESS] All remaining collations fixed successfully!\n";
    }
    
    echo "========================================\n";
    
} catch (Throwable $e) {
    echo "\n[FATAL ERROR] " . $e->getMessage() . "\n";
    echo "Stack trace:\n" . $e->getTraceAsString() . "\n";
    exit(1);
}

