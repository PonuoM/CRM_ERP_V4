<?php
/**
 * Fix Orphaned User References
 * 
 * This script finds and fixes orphaned user_id references that prevent
 * foreign key constraints from being created.
 */

require_once __DIR__ . '/../api/config.php';

echo "========================================\n";
echo "Fix Orphaned User References\n";
echo "========================================\n\n";

try {
    $pdo = db_connect();
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    $dbName = $pdo->query("SELECT DATABASE()")->fetchColumn();
    echo "Database: {$dbName}\n\n";
    
    // Tables with user_id foreign keys that failed
    $tablesToCheck = [
        'customer_assignment_history' => 'user_id',
        'customers' => 'assigned_to',
        'notification_settings' => 'user_id',
        'notification_users' => 'user_id',
        'user_daily_attendance' => 'user_id',
        'user_login_history' => 'user_id',
    ];
    
    echo "Step 1: Finding orphaned references...\n";
    echo "   " . str_repeat("-", 50) . "\n";
    
    $orphanedRecords = [];
    
    foreach ($tablesToCheck as $tableName => $columnName) {
        // Check if table exists
        $tableExists = $pdo->query("
            SELECT COUNT(*) 
            FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_SCHEMA = '{$dbName}'
                AND TABLE_NAME = '{$tableName}'
        ")->fetchColumn();
        
        if ($tableExists == 0) {
            echo "  [SKIP] Table {$tableName} does not exist\n";
            continue;
        }
        
        // Check if column exists
        $columnExists = $pdo->query("
            SELECT COUNT(*) 
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = '{$dbName}'
                AND TABLE_NAME = '{$tableName}'
                AND COLUMN_NAME = '{$columnName}'
        ")->fetchColumn();
        
        if ($columnExists == 0) {
            echo "  [SKIP] Column {$tableName}.{$columnName} does not exist\n";
            continue;
        }
        
        // Find orphaned references
        $orphaned = $pdo->query("
            SELECT COUNT(*) as count
            FROM `{$tableName}` t
            LEFT JOIN `users` u ON t.`{$columnName}` = u.id
            WHERE t.`{$columnName}` IS NOT NULL
                AND u.id IS NULL
        ")->fetch(PDO::FETCH_ASSOC);
        
        $count = (int) $orphaned['count'];
        
        if ($count > 0) {
            $orphanedRecords[$tableName] = [
                'column' => $columnName,
                'count' => $count
            ];
            echo "  [WARN] {$tableName}.{$columnName}: {$count} orphaned records found\n";
            
            // Show sample orphaned values
            $samples = $pdo->query("
                SELECT DISTINCT t.`{$columnName}` as orphaned_id
                FROM `{$tableName}` t
                LEFT JOIN `users` u ON t.`{$columnName}` = u.id
                WHERE t.`{$columnName}` IS NOT NULL
                    AND u.id IS NULL
                LIMIT 5
            ")->fetchAll(PDO::FETCH_COLUMN);
            
            echo "      Sample orphaned IDs: " . implode(", ", $samples) . "\n";
        } else {
            echo "  [OK] {$tableName}.{$columnName}: No orphaned records\n";
        }
    }
    
    echo "\n";
    
    if (count($orphanedRecords) === 0) {
        echo "[SUCCESS] No orphaned references found!\n";
        echo "You can now recreate the foreign keys manually.\n";
        echo "========================================\n";
        exit(0);
    }
    
    // Show summary
    $totalOrphaned = array_sum(array_column($orphanedRecords, 'count'));
    echo "Step 2: Summary\n";
    echo "   " . str_repeat("-", 50) . "\n";
    echo "Total orphaned records: {$totalOrphaned}\n";
    echo "Tables affected: " . count($orphanedRecords) . "\n\n";
    
    // Ask what to do
    echo "Options:\n";
    echo "  1. Set orphaned references to NULL (recommended)\n";
    echo "  2. Delete records with orphaned references\n";
    echo "  3. Show detailed list only (do nothing)\n";
    echo "\n";
    echo "Enter choice (1-3): ";
    
    $handle = fopen("php://stdin", "r");
    $choice = trim(fgets($handle));
    fclose($handle);
    
    echo "\n";
    
    if ($choice == '1') {
        echo "Step 3: Setting orphaned references to NULL...\n";
        echo "   " . str_repeat("-", 50) . "\n";
        
        foreach ($orphanedRecords as $tableName => $info) {
            $columnName = $info['column'];
            try {
                $pdo->exec("
                    UPDATE `{$tableName}` t
                    LEFT JOIN `users` u ON t.`{$columnName}` = u.id
                    SET t.`{$columnName}` = NULL
                    WHERE t.`{$columnName}` IS NOT NULL
                        AND u.id IS NULL
                ");
                echo "  [OK] Updated {$tableName}.{$columnName}: {$info['count']} records set to NULL\n";
            } catch (PDOException $e) {
                echo "  [ERROR] Failed to update {$tableName}: " . $e->getMessage() . "\n";
            }
        }
        
        echo "\n";
        echo "[SUCCESS] All orphaned references have been set to NULL!\n";
        echo "You can now recreate the foreign keys.\n";
        
    } elseif ($choice == '2') {
        echo "Step 3: Deleting records with orphaned references...\n";
        echo "   " . str_repeat("-", 50) . "\n";
        echo "WARNING: This will DELETE records! Are you sure? (yes/no): ";
        
        $handle = fopen("php://stdin", "r");
        $confirm = trim(fgets($handle));
        fclose($handle);
        
        if (strtolower($confirm) !== 'yes') {
            echo "\nOperation cancelled.\n";
            exit(0);
        }
        
        echo "\n";
        
        foreach ($orphanedRecords as $tableName => $info) {
            $columnName = $info['column'];
            try {
                $deleted = $pdo->exec("
                    DELETE t FROM `{$tableName}` t
                    LEFT JOIN `users` u ON t.`{$columnName}` = u.id
                    WHERE t.`{$columnName}` IS NOT NULL
                        AND u.id IS NULL
                ");
                echo "  [OK] Deleted {$deleted} records from {$tableName}\n";
            } catch (PDOException $e) {
                echo "  [ERROR] Failed to delete from {$tableName}: " . $e->getMessage() . "\n";
            }
        }
        
        echo "\n";
        echo "[SUCCESS] All orphaned records have been deleted!\n";
        echo "You can now recreate the foreign keys.\n";
        
    } else {
        echo "Step 3: Detailed list of orphaned references...\n";
        echo "   " . str_repeat("-", 50) . "\n";
        
        foreach ($orphanedRecords as $tableName => $info) {
            $columnName = $info['column'];
            
            $details = $pdo->query("
                SELECT t.*, t.`{$columnName}` as orphaned_user_id
                FROM `{$tableName}` t
                LEFT JOIN `users` u ON t.`{$columnName}` = u.id
                WHERE t.`{$columnName}` IS NOT NULL
                    AND u.id IS NULL
                LIMIT 10
            ")->fetchAll(PDO::FETCH_ASSOC);
            
            echo "\n{$tableName}.{$columnName} ({$info['count']} records):\n";
            foreach ($details as $row) {
                $rowStr = json_encode($row, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
                echo "  - {$rowStr}\n";
            }
            if ($info['count'] > 10) {
                echo "  ... and " . ($info['count'] - 10) . " more records\n";
            }
        }
    }
    
    echo "\n========================================\n";
    
} catch (Throwable $e) {
    echo "\n[FATAL ERROR] " . $e->getMessage() . "\n";
    echo "Stack trace:\n" . $e->getTraceAsString() . "\n";
    exit(1);
}

