<?php
// Database setup script
// Run this after starting MySQL service

$DB_HOST = '127.0.0.1';
$DB_PORT = '3306';
$DB_NAME = 'mini_erp';
$DB_USER = 'root';
$DB_PASS = '12345678';

echo "Setting up database...\n";

try {
    // Connect without specifying database first
    $dsn = "mysql:host={$DB_HOST};port={$DB_PORT};charset=utf8mb4";
    $pdo = new PDO($dsn, $DB_USER, $DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    
    echo "✓ Connected to MySQL server\n";
    
    // Create database
    $pdo->exec("CREATE DATABASE IF NOT EXISTS `{$DB_NAME}` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    echo "✓ Database '{$DB_NAME}' created/verified\n";
    
    // Use the database
    $pdo->exec("USE `{$DB_NAME}`");
    echo "✓ Using database '{$DB_NAME}'\n";
    
    // Read and execute schema
    $schema = file_get_contents(__DIR__ . '/api/schema.sql');
    if ($schema) {
        $pdo->exec($schema);
        echo "✓ Database schema created\n";
    }
    
    // Read and execute seed data
    $seed = file_get_contents(__DIR__ . '/api/seed.sql');
    if ($seed) {
        $pdo->exec($seed);
        echo "✓ Sample data inserted\n";
    }
    
    echo "\n🎉 Database setup completed successfully!\n";
    echo "You can now run your application.\n";
    
} catch (PDOException $e) {
    echo "❌ Database setup failed: " . $e->getMessage() . "\n";
    echo "\nMake sure MySQL service is running:\n";
    echo "1. Open Command Prompt as Administrator\n";
    echo "2. Run: net start mysql8\n";
    echo "3. Then run this script again\n";
}
?>
