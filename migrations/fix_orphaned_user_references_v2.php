<?php
/**
 * Fix Orphaned User References (Version 2 - Direct Approach)
 * 
 * This script fixes orphaned user_id references by directly deleting
 * or setting to NULL based on column constraints.
 */

require_once __DIR__ . '/../api/config.php';

echo "========================================\n";
echo "Fix Orphaned User References (v2)\n";
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
    
    echo "Step 1: Finding and fixing orphaned references...\n";
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
        
        // Get all user IDs that exist
        $validUserIds = $pdo->query("SELECT id FROM users")->fetchAll(PDO::FETCH_COLUMN);
        $validUserIdsStr = count($validUserIds) > 0 ? implode(',', array_map('intval', $validUserIds)) : '0';
        
        // Count orphaned references
        $orphaned = $pdo->query("
            SELECT COUNT(*) as count
            FROM `{$tableName}`
            WHERE `{$columnName}` IS NOT NULL
                AND `{$columnName}` NOT IN ({$validUserIdsStr})
        ")->fetch(PDO::FETCH_ASSOC);
        
        $count = (int) $orphaned['count'];
        
        if ($count > 0) {
            // Get sample orphaned IDs
            $sampleIds = $pdo->query("
                SELECT DISTINCT `{$columnName}` as orphaned_id
                FROM `{$tableName}`
                WHERE `{$columnName}` IS NOT NULL
                    AND `{$columnName}` NOT IN ({$validUserIdsStr})
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
            
            try {
                if ($isNullable === 'YES') {
                    // Try to set to NULL
                    $affected = $pdo->exec("
                        UPDATE `{$tableName}`
                        SET `{$columnName}` = NULL
                        WHERE `{$columnName}` IS NOT NULL
                            AND `{$columnName}` NOT IN ({$validUserIdsStr})
                    ");
                    
                    // Verify
                    $remaining = $pdo->query("
                        SELECT COUNT(*) 
                        FROM `{$tableName}`
                        WHERE `{$columnName}` IS NOT NULL
                            AND `{$columnName}` NOT IN ({$validUserIdsStr})
                    ")->fetchColumn();
                    
                    if ($remaining == 0) {
                        echo "        -> Fixed: {$affected} records set to NULL\n";
                        $totalFixed += $affected;
                    } else {
                        echo "        -> WARNING: {$remaining} records still orphaned, deleting...\n";
                        $deleted = $pdo->exec("
                            DELETE FROM `{$tableName}`
                            WHERE `{$columnName}` IS NOT NULL
                                AND `{$columnName}` NOT IN ({$validUserIdsStr})
                        ");
                        echo "        -> Deleted: {$deleted} orphaned records\n";
                        $totalFixed += $deleted;
                    }
                } else {
                    // Column is NOT NULL - must delete
                    echo "        -> Column is NOT NULL, deleting orphaned records...\n";
                    
                    $deleted = $pdo->exec("
                        DELETE FROM `{$tableName}`
                        WHERE `{$columnName}` IS NOT NULL
                            AND `{$columnName}` NOT IN ({$validUserIdsStr})
                    ");
                    
                    echo "        -> Deleted: {$deleted} orphaned records\n";
                    $totalFixed += $deleted;
                }
            } catch (PDOException $e) {
                echo "        -> ERROR: " . $e->getMessage() . "\n";
            }
        } else {
            echo "  [OK] {$tableName}.{$columnName}: No orphaned references\n";
        }
    }
    
    echo "\n";
    echo "Step 2: Verifying all orphaned references are fixed...\n";
    echo "   " . str_repeat("-", 50) . "\n";
    
    $allFixed = true;
    foreach ($tablesToFix as $tableName => $columnName) {
        $tableExists = $pdo->query("
            SELECT COUNT(*) 
            FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_SCHEMA = '{$dbName}'
                AND TABLE_NAME = '{$tableName}'
        ")->fetchColumn();
        
        if ($tableExists == 0) continue;
        
        $validUserIds = $pdo->query("SELECT id FROM users")->fetchAll(PDO::FETCH_COLUMN);
        $validUserIdsStr = count($validUserIds) > 0 ? implode(',', array_map('intval', $validUserIds)) : '0';
        
        $remaining = $pdo->query("
            SELECT COUNT(*) 
            FROM `{$tableName}`
            WHERE `{$columnName}` IS NOT NULL
                AND `{$columnName}` NOT IN ({$validUserIdsStr})
        ")->fetchColumn();
        
        if ($remaining > 0) {
            echo "  [WARN] {$tableName}.{$columnName}: {$remaining} orphaned references still exist\n";
            $allFixed = false;
        } else {
            echo "  [OK] {$tableName}.{$columnName}: All clean\n";
        }
    }
    
    echo "\n";
    echo "========================================\n";
    echo "Summary\n";
    echo "========================================\n";
    echo "Total records fixed: {$totalFixed}\n";
    
    if ($allFixed) {
        echo "\n[SUCCESS] All orphaned references have been fixed!\n";
        echo "You can now run recreate_failed_foreign_keys.php to recreate the foreign keys.\n";
    } else {
        echo "\n[WARN] Some orphaned references may still exist. Please review the output above.\n";
    }
    
    echo "========================================\n";
    
} catch (Throwable $e) {
    echo "\n[FATAL ERROR] " . $e->getMessage() . "\n";
    echo "Stack trace:\n" . $e->getTraceAsString() . "\n";
    exit(1);
}

