<?php
/**
 * Test and Fix Connection Collation
 * 
 * This script tests if connection collation is properly set
 */

require_once __DIR__ . '/../api/config.php';

echo "========================================\n";
echo "Connection Collation Test\n";
echo "========================================\n\n";

try {
    $pdo = db_connect();
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    echo "Before setting collation:\n";
    echo "   " . str_repeat("-", 50) . "\n";
    
    $result = $pdo->query("SELECT @@collation_connection as conn, @@collation_database as db, @@character_set_connection as charset")->fetch(PDO::FETCH_ASSOC);
    echo "  Connection Collation: {$result['conn']}\n";
    echo "  Database Collation: {$result['db']}\n";
    echo "  Connection Charset: {$result['charset']}\n\n";
    
    // Set collation explicitly
    echo "Setting collation...\n";
    $pdo->exec("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
    $pdo->exec("SET CHARACTER SET utf8mb4");
    $pdo->exec("SET collation_connection = utf8mb4_unicode_ci");
    
    echo "\nAfter setting collation:\n";
    echo "   " . str_repeat("-", 50) . "\n";
    
    $result = $pdo->query("SELECT @@collation_connection as conn, @@collation_database as db, @@character_set_connection as charset")->fetch(PDO::FETCH_ASSOC);
    echo "  Connection Collation: {$result['conn']}\n";
    echo "  Database Collation: {$result['db']}\n";
    echo "  Connection Charset: {$result['charset']}\n\n";
    
    // Test string comparison
    echo "Testing string comparison...\n";
    echo "   " . str_repeat("-", 50) . "\n";
    
    $testResult = $pdo->query("
        SELECT 'test' COLLATE utf8mb4_unicode_ci = 'TEST' COLLATE utf8mb4_unicode_ci as test_equal,
               'test' COLLATE utf8mb4_unicode_ci = 'test' COLLATE utf8mb4_unicode_ci as test_same
    ")->fetch(PDO::FETCH_ASSOC);
    
    echo "  Test equal: " . ($testResult['test_equal'] ? 'PASS' : 'FAIL') . "\n";
    echo "  Test same: " . ($testResult['test_same'] ? 'PASS' : 'FAIL') . "\n\n";
    
    echo "========================================\n";
    echo "[SUCCESS] Connection collation test completed!\n";
    echo "========================================\n";
    
} catch (Throwable $e) {
    echo "\n[FATAL ERROR] " . $e->getMessage() . "\n";
    echo "Stack trace:\n" . $e->getTraceAsString() . "\n";
    exit(1);
}

