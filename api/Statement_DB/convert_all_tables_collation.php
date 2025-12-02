<?php
/**
 * Comprehensive Database Collation Fix Script
 * 
 * This script converts ALL tables and columns in the database to utf8mb4_unicode_ci
 * to prevent collation mismatch errors.
 * 
 * IMPORTANT: This script should be run once. It will:
 * 1. Check all tables in the database
 * 2. Convert each table to utf8mb4_unicode_ci
 * 3. Report on the conversion status
 */

header("Content-Type: text/plain; charset=utf-8");
require_once __DIR__ . "/../config.php";

echo "=== Database-Wide Collation Conversion ===\n\n";
echo "Target: utf8mb4_unicode_ci\n\n";

try {
    $pdo = db_connect();
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    $dbName = $pdo->query("SELECT DATABASE()")->fetchColumn();
    echo "Database: $dbName\n";
    echo "MySQL Version: " . $pdo->query("SELECT VERSION()")->fetchColumn() . "\n\n";
    
    // Get all tables in the database
    $stmt = $pdo->query("SHOW TABLES");
    $tables = $stmt->fetchAll(PDO::FETCH_COLUMN);
    
    echo "Found " . count($tables) . " tables to process\n\n";
    echo "=== Step 1: Analyzing Current Collations ===\n\n";
    
    $tablesToFix = [];
    
    foreach ($tables as $table) {
        $tableInfo = $pdo->query("
            SELECT TABLE_COLLATION 
            FROM information_schema.TABLES 
            WHERE TABLE_SCHEMA = DATABASE() 
              AND TABLE_NAME = '$table'
        ")->fetch(PDO::FETCH_ASSOC);
        
        if ($tableInfo) {
            $currentCollation = $tableInfo['TABLE_COLLATION'];
            $needsFix = ($currentCollation !== 'utf8mb4_unicode_ci');
            
            if ($needsFix) {
                echo "✗ $table: $currentCollation (NEEDS FIX)\n";
                $tablesToFix[] = $table;
            } else {
                echo "✓ $table: $currentCollation (OK)\n";
            }
        }
    }
    
    if (empty($tablesToFix)) {
        echo "\n✓✓✓ All tables already using utf8mb4_unicode_ci! ✓✓✓\n";
        exit(0);
    }
    
    echo "\n=== Step 2: Converting Tables ===\n\n";
    echo "Tables to convert: " . count($tablesToFix) . "\n\n";
    
    // Get all foreign key constraints before conversion
    echo "Identifying foreign key constraints...\n";
    $foreignKeys = [];
    
    $fkQuery = $pdo->query("
        SELECT 
            TABLE_NAME,
            CONSTRAINT_NAME,
            COLUMN_NAME,
            REFERENCED_TABLE_NAME,
            REFERENCED_COLUMN_NAME
        FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE()
          AND REFERENCED_TABLE_NAME IS NOT NULL
        ORDER BY TABLE_NAME, CONSTRAINT_NAME
    ");
    
    while ($fk = $fkQuery->fetch(PDO::FETCH_ASSOC)) {
        $table = $fk['TABLE_NAME'];
        if (!isset($foreignKeys[$table])) {
            $foreignKeys[$table] = [];
        }
        $foreignKeys[$table][$fk['CONSTRAINT_NAME']] = $fk;
    }
    
    echo "Found " . array_sum(array_map('count', $foreignKeys)) . " foreign key constraints\n\n";
    
    // Drop foreign keys that might block conversion
    echo "=== Step 3: Temporarily Dropping Foreign Keys ===\n\n";
    
    foreach ($foreignKeys as $table => $constraints) {
        foreach ($constraints as $constraintName => $fk) {
            try {
                $pdo->exec("ALTER TABLE `$table` DROP FOREIGN KEY `$constraintName`");
                echo "✓ Dropped: $table.$constraintName\n";
            } catch (PDOException $e) {
                echo "⚠ Could not drop: $table.$constraintName - " . $e->getMessage() . "\n";
            }
        }
    }
    
    echo "\n=== Step 4: Converting Tables to utf8mb4_unicode_ci ===\n\n";
    
    $converted = 0;
    $failed = [];
    
    foreach ($tablesToFix as $table) {
        echo "Converting: $table ... ";
        
        try {
            $start = microtime(true);
            $pdo->exec("ALTER TABLE `$table` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
            $duration = round((microtime(true) - $start) * 1000, 2);
            echo "✓ Done ({$duration}ms)\n";
            $converted++;
        } catch (PDOException $e) {
            echo "✗ FAILED\n";
            echo "   Error: " . $e->getMessage() . "\n";
            $failed[] = $table;
        }
    }
    
    echo "\n=== Step 5: Restoring Foreign Keys ===\n\n";
    
    // Get referential actions for each FK
    $fkDetails = $pdo->query("
        SELECT 
            rc.CONSTRAINT_NAME,
            rc.TABLE_NAME,
            rc.DELETE_RULE,
            rc.UPDATE_RULE,
            kcu.COLUMN_NAME,
            kcu.REFERENCED_TABLE_NAME,
            kcu.REFERENCED_COLUMN_NAME
        FROM information_schema.REFERENTIAL_CONSTRAINTS rc
        INNER JOIN information_schema.KEY_COLUMN_USAGE kcu 
            ON rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME 
            AND rc.TABLE_NAME = kcu.TABLE_NAME
            AND rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
        WHERE rc.CONSTRAINT_SCHEMA = DATABASE()
        ORDER BY rc.TABLE_NAME, rc.CONSTRAINT_NAME
    ")->fetchAll(PDO::FETCH_ASSOC);
    
    $restored = 0;
    $fkFailed = [];
    
    foreach ($fkDetails as $fk) {
        $table = $fk['TABLE_NAME'];
        $constraintName = $fk['CONSTRAINT_NAME'];
        $column = $fk['COLUMN_NAME'];
        $refTable = $fk['REFERENCED_TABLE_NAME'];
        $refColumn = $fk['REFERENCED_COLUMN_NAME'];
        $onDelete = $fk['DELETE_RULE'];
        $onUpdate = $fk['UPDATE_RULE'];
        
        // Skip if the original constraint still exists
        $checkExists = $pdo->query("
            SELECT COUNT(*) 
            FROM information_schema.TABLE_CONSTRAINTS 
            WHERE TABLE_SCHEMA = DATABASE() 
              AND TABLE_NAME = '$table' 
              AND CONSTRAINT_NAME = '$constraintName'
              AND CONSTRAINT_TYPE = 'FOREIGN KEY'
        ")->fetchColumn();
        
        if ($checkExists > 0) {
            echo "✓ Already exists: $table.$constraintName\n";
            continue;
        }
        
        try {
            $sql = "ALTER TABLE `$table` ADD CONSTRAINT `$constraintName` 
                    FOREIGN KEY (`$column`) REFERENCES `$refTable`(`$refColumn`) 
                    ON DELETE $onDelete ON UPDATE $onUpdate";
            
            $pdo->exec($sql);
            echo "✓ Restored: $table.$constraintName\n";
            $restored++;
        } catch (PDOException $e) {
            echo "⚠ Could not restore: $table.$constraintName\n";
            echo "   Error: " . $e->getMessage() . "\n";
            echo "   SQL: $sql\n";
            $fkFailed[] = "$table.$constraintName";
        }
    }
    
    echo "\n=== Step 6: Final Verification ===\n\n";
    
    $verifyStmt = $pdo->query("
        SELECT TABLE_NAME, TABLE_COLLATION
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE()
        ORDER BY TABLE_NAME
    ");
    
    $allCorrect = true;
    $incorrectCount = 0;
    
    while ($row = $verifyStmt->fetch(PDO::FETCH_ASSOC)) {
        $isCorrect = ($row['TABLE_COLLATION'] === 'utf8mb4_unicode_ci');
        if (!$isCorrect) {
            echo "✗ " . $row['TABLE_NAME'] . ": " . $row['TABLE_COLLATION'] . "\n";
            $allCorrect = false;
            $incorrectCount++;
        }
    }
    
    if ($allCorrect) {
        echo "✓ All tables are now using utf8mb4_unicode_ci\n";
    } else {
        echo "$incorrectCount tables still have incorrect collation\n";
    }
    
    echo "\n=== Summary ===\n\n";
    echo "Total tables: " . count($tables) . "\n";
    echo "Tables converted: $converted\n";
    echo "Conversion failures: " . count($failed) . "\n";
    echo "Foreign keys restored: $restored\n";
    echo "Foreign key restoration failures: " . count($fkFailed) . "\n";
    
    if (!empty($failed)) {
        echo "\nFailed table conversions:\n";
        foreach ($failed as $table) {
            echo "  - $table\n";
        }
    }
    
    if (!empty($fkFailed)) {
        echo "\nFailed foreign key restorations:\n";
        foreach ($fkFailed as $fk) {
            echo "  - $fk\n";
        }
    }
    
    echo "\n";
    
    if ($allCorrect && empty($failed)) {
        echo "✓✓✓ DATABASE CONVERSION COMPLETE! ✓✓✓\n\n";
        echo "All tables are now using utf8mb4_unicode_ci.\n";
        echo "You can now test the Finance Approval page.\n";
    } else {
        echo "⚠ CONVERSION INCOMPLETE ⚠\n\n";
        echo "Some issues were encountered. Please review the output above.\n";
    }
    
} catch (Exception $e) {
    echo "\n✗✗✗ FATAL ERROR ✗✗✗\n\n";
    echo "Error: " . $e->getMessage() . "\n";
    echo "Trace: " . $e->getTraceAsString() . "\n";
}

echo "\n=== Script Complete ===\n";
