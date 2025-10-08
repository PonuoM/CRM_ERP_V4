<?php
// Test database connection
require_once __DIR__ . '/api/config.php';

echo "Testing database connection...\n";

try {
    $pdo = db_connect();
    echo "✓ Database connection successful!\n";
    
    // Test a simple query
    $stmt = $pdo->query("SELECT COUNT(*) as count FROM companies");
    $result = $stmt->fetch();
    echo "✓ Query test successful. Companies in database: " . $result['count'] . "\n";
    
    echo "\n🎉 Database is working correctly!\n";
    
} catch (Exception $e) {
    echo "❌ Database connection failed: " . $e->getMessage() . "\n";
    echo "\nTroubleshooting steps:\n";
    echo "1. Make sure MySQL service is running\n";
    echo "2. Check if database 'mini_erp' exists\n";
    echo "3. Verify credentials in api/config.php\n";
}
?>
