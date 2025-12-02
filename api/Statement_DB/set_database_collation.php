<?php
/**
 * Set Database Default Collation to utf8mb4_unicode_ci
 * 
 * This ensures the database itself has the correct default collation
 */

header("Content-Type: text/plain; charset=utf-8");
require_once __DIR__ . "/../config.php";

echo "=== Setting Database Default Collation ===\n\n";

try {
    $pdo = db_connect();
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    $dbName = $pdo->query("SELECT DATABASE()")->fetchColumn();
    
    echo "Database: $dbName\n";
    echo "MySQL Version: " . $pdo->query("SELECT VERSION()")->fetchColumn() . "\n\n";
    
    // Check current database collation
    $current = $pdo->query("
        SELECT DEFAULT_CHARACTER_SET_NAME, DEFAULT_COLLATION_NAME 
        FROM information_schema.SCHEMATA 
        WHERE SCHEMA_NAME = DATABASE()
    ")->fetch(PDO::FETCH_ASSOC);
    
    echo "Current Database Defaults:\n";
    echo "  Charset: " . $current['DEFAULT_CHARACTER_SET_NAME'] . "\n";
    echo "  Collation: " . $current['DEFAULT_COLLATION_NAME'] . "\n\n";
    
    if ($current['DEFAULT_COLLATION_NAME'] === 'utf8mb4_unicode_ci') {
        echo "✓ Database already using utf8mb4_unicode_ci\n";
    } else {
        echo "Changing database default collation to utf8mb4_unicode_ci...\n";
        
        $pdo->exec("ALTER DATABASE `$dbName` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
        
        // Verify
        $new = $pdo->query("
            SELECT DEFAULT_CHARACTER_SET_NAME, DEFAULT_COLLATION_NAME 
            FROM information_schema.SCHEMATA 
            WHERE SCHEMA_NAME = DATABASE()
        ")->fetch(PDO::FETCH_ASSOC);
        
        echo "\nNew Database Defaults:\n";
        echo "  Charset: " . $new['DEFAULT_CHARACTER_SET_NAME'] . "\n";
        echo "  Collation: " . $new['DEFAULT_COLLATION_NAME'] . "\n\n";
        
        if ($new['DEFAULT_COLLATION_NAME'] === 'utf8mb4_unicode_ci') {
            echo "✓✓✓ Database collation changed successfully! ✓✓✓\n";
        } else {
            echo "✗ Database collation change failed\n";
        }
    }
    
} catch (Exception $e) {
    echo "\n✗✗✗ ERROR ✗✗✗\n";
    echo $e->getMessage() . "\n";
}
