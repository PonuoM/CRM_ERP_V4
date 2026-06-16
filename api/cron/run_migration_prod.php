<?php
/**
 * Run migration 029 on the database connected via api/config.php
 */
require_once __DIR__ . '/../config.php';

try {
    $pdo = db_connect();
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    echo "Connected successfully to " . $DB_NAME . "\n";
    
    $sqlFile = __DIR__ . '/../migrations/029_add_upsell_timeout_and_fix_enum.sql';
    if (!file_exists($sqlFile)) {
        throw new Exception("Migration file not found at: $sqlFile");
    }
    
    $sql = file_get_contents($sqlFile);
    echo "Running migration SQL...\n";
    
    // Execute DDL and DML
    $pdo->exec($sql);
    
    echo "🎉 Migration 029 executed successfully on production database!\n";
} catch (Exception $e) {
    echo "❌ Migration failed: " . $e->getMessage() . "\n";
}
?>
