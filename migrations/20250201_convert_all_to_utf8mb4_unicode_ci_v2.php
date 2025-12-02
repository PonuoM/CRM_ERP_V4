<?php
/**
 * Migration Script: Convert All Collations to utf8mb4_unicode_ci
 * Date: 2025-02-01
 * 
 * This PHP script is safer than pure SQL because it can:
 * - Handle errors more gracefully
 * - Show progress
 * - Store FK information properly
 * - Convert columns more efficiently
 * 
 * IMPORTANT: Backup your database before running this script!
 */

require_once __DIR__ . '/../api/config.php';

// Set output encoding for Windows compatibility
if (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN') {
    @exec('chcp 65001 >nul 2>&1'); // Set UTF-8 code page on Windows
}

echo "========================================\n";
echo "Collation Migration Script\n";
echo "Converting all to utf8mb4_unicode_ci\n";
echo "========================================\n";
echo "\n";
echo "WARNING: Please backup your database before proceeding!\n";
echo "This will convert all tables and columns to utf8mb4_unicode_ci.\n";
echo "\n";
echo "Press Ctrl+C to cancel, or Enter to continue...\n";
$handle = fopen("php://stdin", "r");
$line = fgets($handle);
fclose($handle);
echo "\n";

$targetCollation = 'utf8mb4_unicode_ci';
$errors = [];
$startTime = microtime(true);

try {
    $pdo = db_connect();
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    $dbName = $pdo->query("SELECT DATABASE()")->fetchColumn();
    echo "Database: {$dbName}\n";
    echo "Target Collation: {$targetCollation}\n\n";
    
    // ========================================================================
    // Step 1: Get all foreign keys and store them
    // ========================================================================
    echo "Step 1: Collecting foreign key information...\n";
    
    $fks = $pdo->query("
        SELECT 
            kcu.CONSTRAINT_NAME,
            kcu.TABLE_NAME,
            kcu.COLUMN_NAME,
            kcu.REFERENCED_TABLE_NAME,
            kcu.REFERENCED_COLUMN_NAME,
            rc.UPDATE_RULE,
            rc.DELETE_RULE
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
        JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
            ON kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
            AND kcu.TABLE_SCHEMA = rc.CONSTRAINT_SCHEMA
        WHERE kcu.TABLE_SCHEMA = '{$dbName}'
            AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
        ORDER BY kcu.TABLE_NAME, kcu.CONSTRAINT_NAME
    ")->fetchAll(PDO::FETCH_ASSOC);
    
    echo "Found " . count($fks) . " foreign key constraints\n\n";
    
    // ========================================================================
    // Step 2: Drop all foreign keys
    // ========================================================================
    echo "Step 2: Dropping foreign key constraints...\n";
    
    foreach ($fks as $fk) {
        try {
            $pdo->exec("ALTER TABLE `{$fk['TABLE_NAME']}` DROP FOREIGN KEY `{$fk['CONSTRAINT_NAME']}`");
            echo "  [OK] Dropped FK: {$fk['TABLE_NAME']}.{$fk['CONSTRAINT_NAME']}\n";
        } catch (PDOException $e) {
            // Ignore if FK doesn't exist
            if (strpos($e->getMessage(), 'Unknown key') === false) {
                echo "  [WARN] Warning: " . $e->getMessage() . "\n";
            }
        }
    }
    echo "\n";
    
    // ========================================================================
    // Step 3: Convert table default collations
    // ========================================================================
    echo "Step 3: Converting table default collations...\n";
    
    $tables = $pdo->query("
        SELECT TABLE_NAME
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = '{$dbName}'
            AND TABLE_TYPE = 'BASE TABLE'
            AND TABLE_COLLATION = 'utf8mb4_0900_ai_ci'
        ORDER BY TABLE_NAME
    ")->fetchAll(PDO::FETCH_COLUMN);
    
    echo "Found " . count($tables) . " tables to convert\n";
    
    foreach ($tables as $tableName) {
        try {
            $pdo->exec("ALTER TABLE `{$tableName}` CONVERT TO CHARACTER SET utf8mb4 COLLATE {$targetCollation}");
            echo "  [OK] Converted table: {$tableName}\n";
        } catch (PDOException $e) {
            $errors[] = "Table {$tableName}: " . $e->getMessage();
            echo "  [ERROR] Error converting table {$tableName}: " . $e->getMessage() . "\n";
        }
    }
    echo "\n";
    
    // ========================================================================
    // Step 4: Convert individual columns (for any that didn't convert)
    // ========================================================================
    echo "Step 4: Converting remaining columns...\n";
    
    $columns = $pdo->query("
        SELECT 
            TABLE_NAME,
            COLUMN_NAME,
            COLUMN_TYPE,
            IS_NULLABLE,
            COLUMN_DEFAULT,
            DATA_TYPE,
            CHARACTER_MAXIMUM_LENGTH
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = '{$dbName}'
            AND COLLATION_NAME = 'utf8mb4_0900_ai_ci'
            AND DATA_TYPE IN ('varchar', 'char', 'text', 'tinytext', 'mediumtext', 'longtext', 'enum', 'set')
        ORDER BY TABLE_NAME, ORDINAL_POSITION
    ")->fetchAll(PDO::FETCH_ASSOC);
    
    echo "Found " . count($columns) . " columns to convert\n";
    
    $converted = 0;
    foreach ($columns as $col) {
        try {
            // Build column definition
            $colType = $col['COLUMN_TYPE'];
            $nullable = $col['IS_NULLABLE'] === 'YES' ? 'NULL' : 'NOT NULL';
            $default = '';
            
            if ($col['COLUMN_DEFAULT'] !== null) {
                $defaultVal = $col['COLUMN_DEFAULT'];
                // Handle different default value types
                if (is_numeric($defaultVal) || 
                    $defaultVal === 'CURRENT_TIMESTAMP' || 
                    $defaultVal === 'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') {
                    $default = " DEFAULT {$defaultVal}";
                } else {
                    // Escape single quotes in default value
                    $escapedDefault = str_replace("'", "''", $defaultVal);
                    $default = " DEFAULT '{$escapedDefault}'";
                }
            }
            
            $sql = "ALTER TABLE `{$col['TABLE_NAME']}` 
                    MODIFY COLUMN `{$col['COLUMN_NAME']}` {$colType} 
                    CHARACTER SET utf8mb4 COLLATE {$targetCollation} 
                    {$nullable}{$default}";
            
            $pdo->exec($sql);
            $converted++;
            
            if ($converted % 10 === 0) {
                echo "  [OK] Converted {$converted} columns...\n";
            }
        } catch (PDOException $e) {
            $errors[] = "Column {$col['TABLE_NAME']}.{$col['COLUMN_NAME']}: " . $e->getMessage();
            echo "  [ERROR] Error converting {$col['TABLE_NAME']}.{$col['COLUMN_NAME']}: " . $e->getMessage() . "\n";
        }
    }
    
    echo "  [OK] Converted {$converted} columns total\n\n";
    
    // ========================================================================
    // Step 5: Recreate foreign keys (with collation verification)
    // ========================================================================
    echo "Step 5: Recreating foreign key constraints...\n";
    
    $fkRecreated = 0;
    $fkSkipped = 0;
    
    foreach ($fks as $fk) {
        try {
            // Verify both columns have same collation before creating FK
            $sourceCollation = $pdo->query("
                SELECT COLLATION_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = '{$dbName}'
                    AND TABLE_NAME = '{$fk['TABLE_NAME']}'
                    AND COLUMN_NAME = '{$fk['COLUMN_NAME']}'
            ")->fetchColumn();
            
            $targetCollation = $pdo->query("
                SELECT COLLATION_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = '{$dbName}'
                    AND TABLE_NAME = '{$fk['REFERENCED_TABLE_NAME']}'
                    AND COLUMN_NAME = '{$fk['REFERENCED_COLUMN_NAME']}'
            ")->fetchColumn();
            
            // Skip if either column is not a string type (no collation)
            if (!$sourceCollation || !$targetCollation) {
                $updateRule = $fk['UPDATE_RULE'] ?? 'NO ACTION';
                $deleteRule = $fk['DELETE_RULE'] ?? 'NO ACTION';
                
                $sql = "ALTER TABLE `{$fk['TABLE_NAME']}` 
                        ADD CONSTRAINT `{$fk['CONSTRAINT_NAME']}` 
                        FOREIGN KEY (`{$fk['COLUMN_NAME']}`) 
                        REFERENCES `{$fk['REFERENCED_TABLE_NAME']}` (`{$fk['REFERENCED_COLUMN_NAME']}`) 
                        ON DELETE {$deleteRule} 
                        ON UPDATE {$updateRule}";
                
                $pdo->exec($sql);
                $fkRecreated++;
                echo "  [OK] Recreated FK: {$fk['TABLE_NAME']}.{$fk['CONSTRAINT_NAME']}\n";
                continue;
            }
            
            // If both have collations, verify they match
            if ($sourceCollation === $targetCollation) {
                $updateRule = $fk['UPDATE_RULE'] ?? 'NO ACTION';
                $deleteRule = $fk['DELETE_RULE'] ?? 'NO ACTION';
                
                $sql = "ALTER TABLE `{$fk['TABLE_NAME']}` 
                        ADD CONSTRAINT `{$fk['CONSTRAINT_NAME']}` 
                        FOREIGN KEY (`{$fk['COLUMN_NAME']}`) 
                        REFERENCES `{$fk['REFERENCED_TABLE_NAME']}` (`{$fk['REFERENCED_COLUMN_NAME']}`) 
                        ON DELETE {$deleteRule} 
                        ON UPDATE {$updateRule}";
                
                $pdo->exec($sql);
                $fkRecreated++;
                echo "  [OK] Recreated FK: {$fk['TABLE_NAME']}.{$fk['CONSTRAINT_NAME']}\n";
            } else {
                $errors[] = "FK {$fk['TABLE_NAME']}.{$fk['CONSTRAINT_NAME']}: Collation mismatch (source: {$sourceCollation}, target: {$targetCollation})";
                $fkSkipped++;
                echo "  [WARN] Skipped FK: {$fk['TABLE_NAME']}.{$fk['CONSTRAINT_NAME']} - Collation mismatch\n";
            }
        } catch (PDOException $e) {
            // Ignore if FK already exists
            if (strpos($e->getMessage(), 'Duplicate key name') !== false || 
                strpos($e->getMessage(), 'already exists') !== false) {
                $fkSkipped++;
                continue;
            }
            $errors[] = "FK {$fk['TABLE_NAME']}.{$fk['CONSTRAINT_NAME']}: " . $e->getMessage();
            echo "  [WARN] Warning: {$fk['TABLE_NAME']}.{$fk['CONSTRAINT_NAME']} - " . $e->getMessage() . "\n";
        }
    }
    
    echo "  Recreated: {$fkRecreated}, Skipped: {$fkSkipped}\n";
    echo "\n";
    
    // ========================================================================
    // Step 6: Verification
    // ========================================================================
    echo "Step 6: Verifying conversion...\n";
    
    $remainingTables = $pdo->query("
        SELECT COUNT(*) 
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = '{$dbName}'
            AND TABLE_TYPE = 'BASE TABLE'
            AND TABLE_COLLATION = 'utf8mb4_0900_ai_ci'
    ")->fetchColumn();
    
    $remainingColumns = $pdo->query("
        SELECT COUNT(*) 
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = '{$dbName}'
            AND COLLATION_NAME = 'utf8mb4_0900_ai_ci'
    ")->fetchColumn();
    
    echo "  Remaining tables with utf8mb4_0900_ai_ci: {$remainingTables}\n";
    echo "  Remaining columns with utf8mb4_0900_ai_ci: {$remainingColumns}\n\n";
    
    if ($remainingTables > 0 || $remainingColumns > 0) {
        echo "  [WARN] WARNING: Some tables/columns were not converted!\n";
        echo "  Please check the errors above and run verification script.\n\n";
    } else {
        echo "  [SUCCESS] All tables and columns successfully converted!\n\n";
    }
    
    // Calculate execution time
    $endTime = microtime(true);
    $executionTime = round($endTime - $startTime, 2);
    
    // Show summary
    echo "========================================\n";
    echo "Migration Summary\n";
    echo "========================================\n";
    echo "Tables converted: " . count($tables) . "\n";
    echo "Columns converted: {$converted}\n";
    echo "Foreign keys: {$fkRecreated} recreated, {$fkSkipped} skipped\n";
    echo "Execution time: {$executionTime} seconds\n";
    
    if (count($errors) > 0) {
        echo "\n[WARN] Errors encountered: " . count($errors) . "\n";
        echo "\nError details:\n";
        foreach (array_slice($errors, 0, 10) as $error) {
            echo "  - {$error}\n";
        }
        if (count($errors) > 10) {
            echo "  ... and " . (count($errors) - 10) . " more errors.\n";
        }
    } else {
        echo "\n[SUCCESS] Migration completed successfully with no errors!\n";
    }
    
    echo "========================================\n";
    
} catch (Throwable $e) {
    echo "\n[FATAL ERROR] FATAL ERROR: " . $e->getMessage() . "\n";
    echo "Stack trace:\n" . $e->getTraceAsString() . "\n";
    exit(1);
}

