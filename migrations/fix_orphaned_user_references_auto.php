<?php
/**
 * Fix Orphaned User References (Automatic)
 * 
 * This script automatically fixes orphaned user_id references by setting them to NULL.
 * Run this before recreating foreign keys.
 */

require_once __DIR__ . '/../api/config.php';

echo "========================================\n";
echo "Fix Orphaned User References (Automatic)\n";
echo "========================================\n\n";

try {
    $pdo = db_connect();
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    $dbName = $pdo->query("SELECT DATABASE()")->fetchColumn();
    echo "Database: {$dbName}\n\n";
    
    // Tables with user_id foreign keys that failed
    $tablesToFix = [
        'customer_assignment_history' => 'user_id',
        'customers' => 'assigned_to',
        'notification_settings' => 'user_id',
        'notification_users' => 'user_id',
        'user_daily_attendance' => 'user_id',
        'user_login_history' => 'user_id',
    ];
    
    echo "Step 1: Finding orphaned references...\n";
    echo "   " . str_repeat("-", 50) . "\n";
    
    $totalFixed = 0;
    
    foreach ($tablesToFix as $tableName => $columnName) {
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
        
        // Count orphaned references
        $orphaned = $pdo->query("
            SELECT COUNT(*) as count
            FROM `{$tableName}` t
            LEFT JOIN `users` u ON t.`{$columnName}` = u.id
            WHERE t.`{$columnName}` IS NOT NULL
                AND u.id IS NULL
        ")->fetch(PDO::FETCH_ASSOC);
        
        $count = (int) $orphaned['count'];
        
        if ($count > 0) {
            // Get sample orphaned IDs
            $sampleIds = $pdo->query("
                SELECT DISTINCT t.`{$columnName}` as orphaned_id
                FROM `{$tableName}` t
                LEFT JOIN `users` u ON t.`{$columnName}` = u.id
                WHERE t.`{$columnName}` IS NOT NULL
                    AND u.id IS NULL
                LIMIT 5
            ")->fetchAll(PDO::FETCH_COLUMN);
            
            echo "  [FIX] {$tableName}.{$columnName}: {$count} orphaned references found\n";
            echo "        Orphaned user IDs: " . implode(", ", $sampleIds) . "\n";
            
            // Check if column allows NULL
            $columnInfo = $pdo->query("
                SELECT IS_NULLABLE 
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = '{$dbName}'
                    AND TABLE_NAME = '{$tableName}'
                    AND COLUMN_NAME = '{$columnName}'
            ")->fetch(PDO::FETCH_ASSOC);
            
            $isNullable = $columnInfo['IS_NULLABLE'] ?? 'NO';
            
            // Fix by setting to NULL or deleting
            $fixed = false;
            try {
                if ($isNullable === 'YES') {
                    // Can safely set to NULL
                    $affected = $pdo->exec("
                        UPDATE `{$tableName}` t
                        LEFT JOIN `users` u ON t.`{$columnName}` = u.id
                        SET t.`{$columnName}` = NULL
                        WHERE t.`{$columnName}` IS NOT NULL
                            AND u.id IS NULL
                    ");
                    
                    // Verify the update worked
                    $remaining = $pdo->query("
                        SELECT COUNT(*) 
                        FROM `{$tableName}` t
                        LEFT JOIN `users` u ON t.`{$columnName}` = u.id
                        WHERE t.`{$columnName}` IS NOT NULL
                            AND u.id IS NULL
                    ")->fetchColumn();
                    
                    if ($remaining == 0) {
                        echo "        -> Fixed: {$affected} records set to NULL\n";
                        $totalFixed += $affected;
                        $fixed = true;
                    } else {
                        echo "        -> WARNING: Update didn't work ({$remaining} remaining), trying delete...\n";
                    }
                }
                
                // If NULL didn't work or column is NOT NULL, delete records
                if (!$fixed && ($isNullable === 'NO' || ($isNullable === 'YES' && isset($remaining) && $remaining > 0))) {
                    echo "        -> Column is NOT NULL or UPDATE failed, deleting orphaned records...\n";
                    
                    // Get orphaned IDs first
                    $orphanedIds = $pdo->query("
                        SELECT DISTINCT t.`{$columnName}` as orphaned_id
                        FROM `{$tableName}` t
                        LEFT JOIN `users` u ON t.`{$columnName}` = u.id
                        WHERE t.`{$columnName}` IS NOT NULL
                            AND u.id IS NULL
                    ")->fetchAll(PDO::FETCH_COLUMN);
                    
                    if (count($orphanedIds) > 0) {
                        // Delete in batches if too many
                        if (count($orphanedIds) > 100) {
                            $batches = array_chunk($orphanedIds, 100);
                            $deletedTotal = 0;
                            foreach ($batches as $batch) {
                                $ids = implode(',', array_map('intval', $batch));
                                $deleted = $pdo->exec("DELETE FROM `{$tableName}` WHERE `{$columnName}` IN ({$ids})");
                                $deletedTotal += $deleted;
                            }
                            echo "        -> Deleted: {$deletedTotal} orphaned records (batched)\n";
                            $totalFixed += $deletedTotal;
                        } else {
                            $ids = implode(',', array_map('intval', $orphanedIds));
                            $deleted = $pdo->exec("DELETE FROM `{$tableName}` WHERE `{$columnName}` IN ({$ids})");
                            echo "        -> Deleted: {$deleted} orphaned records\n";
                            $totalFixed += $deleted;
                        }
                    }
                }
            } catch (PDOException $e) {
                echo "        -> ERROR: " . $e->getMessage() . "\n";
                
                // Try simpler DELETE syntax
                try {
                    echo "        -> Trying simpler DELETE syntax...\n";
                    
                    // Get orphaned IDs first
                    $orphanedIds = $pdo->query("
                        SELECT DISTINCT t.`{$columnName}` as orphaned_id
                        FROM `{$tableName}` t
                        LEFT JOIN `users` u ON t.`{$columnName}` = u.id
                        WHERE t.`{$columnName}` IS NOT NULL
                            AND u.id IS NULL
                        LIMIT 100
                    ")->fetchAll(PDO::FETCH_COLUMN);
                    
                    if (count($orphanedIds) > 0) {
                        $ids = implode(',', array_map('intval', $orphanedIds));
                        $deleted = $pdo->exec("DELETE FROM `{$tableName}` WHERE `{$columnName}` IN ({$ids})");
                        echo "        -> Deleted: {$deleted} records (simpler method)\n";
                        $totalFixed += $deleted;
                    }
                } catch (PDOException $e2) {
                    echo "        -> FATAL: Could not fix - " . $e2->getMessage() . "\n";
                }
            }
        } else {
            echo "  [OK] {$tableName}.{$columnName}: No orphaned references\n";
        }
    }
    
    echo "\n";
    echo "========================================\n";
    echo "Summary\n";
    echo "========================================\n";
    echo "Total records fixed: {$totalFixed}\n";
    
    if ($totalFixed > 0) {
        echo "\n[SUCCESS] All orphaned references have been fixed!\n";
        echo "You can now run recreate_failed_foreign_keys.php to recreate the foreign keys.\n";
    } else {
        echo "\n[SUCCESS] No orphaned references found!\n";
    }
    
    echo "========================================\n";
    
} catch (Throwable $e) {
    echo "\n[FATAL ERROR] " . $e->getMessage() . "\n";
    echo "Stack trace:\n" . $e->getTraceAsString() . "\n";
    exit(1);
}

