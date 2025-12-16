<?php
require_once __DIR__ . '/config.php';

header('Content-Type: text/plain');

echo "=== ENVIRONMENT DEBUG ===\n";
echo "DB_HOST Env: " . var_export(getenv("DB_HOST"), true) . "\n";
echo "DB_NAME Env: " . var_export(getenv("DB_NAME"), true) . "\n";
echo "DB_USER Env: " . var_export(getenv("DB_USER"), true) . "\n";

echo "\n=== ACTUAL CONFIG USED ===\n";
global $DB_NAME, $DB_USER;
echo "DB_NAME (PHP Var): " . $DB_NAME . "\n";
echo "DB_USER (PHP Var): " . $DB_USER . "\n";

echo "\n=== CONNECTION TEST ===\n";
try {
    $pdo = db_connect();
    echo "Connected successfully.\n";
    
    $stmt = $pdo->query("SELECT DATABASE()");
    $dbName = $stmt->fetchColumn();
    echo "Connected Database: " . $dbName . "\n";
    
    // Check if table exists
    $stmt = $pdo->query("SELECT COUNT(*) FROM statement_reconcile_logs");
    $count = $stmt->fetchColumn();
    echo "Rows in statement_reconcile_logs: " . $count . "\n";

} catch (Exception $e) {
    echo "Connection Failed: " . $e->getMessage() . "\n";
}
?>
