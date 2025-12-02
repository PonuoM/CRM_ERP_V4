<?php
/**
 * Recreate Failed Foreign Keys
 * 
 * After fixing orphaned references, run this to recreate the foreign keys
 * that failed during the collation migration.
 */

require_once __DIR__ . '/../api/config.php';

echo "========================================\n";
echo "Recreate Failed Foreign Keys\n";
echo "========================================\n\n";

try {
    $pdo = db_connect();
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    $dbName = $pdo->query("SELECT DATABASE()")->fetchColumn();
    echo "Database: {$dbName}\n\n";
    
    // Failed foreign keys from the migration
    $failedFKs = [
        [
            'table' => 'customer_assignment_history',
            'name' => 'fk_cah_user',
            'column' => 'user_id',
            'ref_table' => 'users',
            'ref_column' => 'id',
            'on_delete' => 'CASCADE',
            'on_update' => 'NO ACTION'
        ],
        [
            'table' => 'customers',
            'name' => 'fk_customers_assigned_to',
            'column' => 'assigned_to',
            'ref_table' => 'users',
            'ref_column' => 'id',
            'on_delete' => 'NO ACTION',
            'on_update' => 'NO ACTION'
        ],
        [
            'table' => 'notification_settings',
            'name' => 'notification_settings_ibfk_1',
            'column' => 'user_id',
            'ref_table' => 'users',
            'ref_column' => 'id',
            'on_delete' => 'CASCADE',
            'on_update' => 'NO ACTION'
        ],
        [
            'table' => 'notification_users',
            'name' => 'notification_users_ibfk_2',
            'column' => 'user_id',
            'ref_table' => 'users',
            'ref_column' => 'id',
            'on_delete' => 'CASCADE',
            'on_update' => 'NO ACTION'
        ],
        [
            'table' => 'user_daily_attendance',
            'name' => 'fk_attendance_user',
            'column' => 'user_id',
            'ref_table' => 'users',
            'ref_column' => 'id',
            'on_delete' => 'CASCADE',
            'on_update' => 'NO ACTION'
        ],
        [
            'table' => 'user_login_history',
            'name' => 'user_login_history_ibfk_1',
            'column' => 'user_id',
            'ref_table' => 'users',
            'ref_column' => 'id',
            'on_delete' => 'CASCADE',
            'on_update' => 'NO ACTION'
        ],
    ];
    
    echo "Step 1: Verifying orphaned references are fixed...\n";
    echo "   " . str_repeat("-", 50) . "\n";
    
    $allClean = true;
    
    foreach ($failedFKs as $fk) {
        // Check for orphaned references
        $orphaned = $pdo->query("
            SELECT COUNT(*) as count
            FROM `{$fk['table']}` t
            LEFT JOIN `{$fk['ref_table']}` r ON t.`{$fk['column']}` = r.`{$fk['ref_column']}`
            WHERE t.`{$fk['column']}` IS NOT NULL
                AND r.`{$fk['ref_column']}` IS NULL
        ")->fetch(PDO::FETCH_ASSOC);
        
        $count = (int) $orphaned['count'];
        
        if ($count > 0) {
            echo "  [WARN] {$fk['table']}.{$fk['column']}: {$count} orphaned references still exist!\n";
            $allClean = false;
        } else {
            echo "  [OK] {$fk['table']}.{$fk['column']}: No orphaned references\n";
        }
    }
    
    echo "\n";
    
    if (!$allClean) {
        echo "[ERROR] Please run fix_orphaned_user_references.php first!\n";
        echo "========================================\n";
        exit(1);
    }
    
    echo "Step 2: Recreating foreign key constraints...\n";
    echo "   " . str_repeat("-", 50) . "\n";
    
    $successCount = 0;
    $errorCount = 0;
    
    foreach ($failedFKs as $fk) {
        try {
            // Drop FK if exists
            try {
                $pdo->exec("ALTER TABLE `{$fk['table']}` DROP FOREIGN KEY `{$fk['name']}`");
            } catch (PDOException $e) {
                // Ignore if doesn't exist
            }
            
            // Recreate FK
            $sql = "ALTER TABLE `{$fk['table']}` 
                    ADD CONSTRAINT `{$fk['name']}` 
                    FOREIGN KEY (`{$fk['column']}`) 
                    REFERENCES `{$fk['ref_table']}` (`{$fk['ref_column']}`) 
                    ON DELETE {$fk['on_delete']} 
                    ON UPDATE {$fk['on_update']}";
            
            $pdo->exec($sql);
            $successCount++;
            echo "  [OK] Created FK: {$fk['table']}.{$fk['name']}\n";
            
        } catch (PDOException $e) {
            $errorCount++;
            echo "  [ERROR] Failed to create FK: {$fk['table']}.{$fk['name']}\n";
            echo "          Error: " . $e->getMessage() . "\n";
        }
    }
    
    echo "\n";
    echo "========================================\n";
    echo "Summary\n";
    echo "========================================\n";
    echo "Successfully created: {$successCount}\n";
    echo "Failed: {$errorCount}\n";
    
    if ($errorCount > 0) {
        echo "\n[WARN] Some foreign keys could not be created.\n";
        echo "Please check the errors above and fix orphaned references.\n";
    } else {
        echo "\n[SUCCESS] All foreign keys recreated successfully!\n";
    }
    
    echo "========================================\n";
    
} catch (Throwable $e) {
    echo "\n[FATAL ERROR] " . $e->getMessage() . "\n";
    echo "Stack trace:\n" . $e->getTraceAsString() . "\n";
    exit(1);
}

