<?php
require_once __DIR__ . '/../api/config.php';

try {
    echo "Connecting to database...\n";
    $pdo = db_connect();
    echo "Connected.\n";

    $sqlFile = __DIR__ . '/update_customer_schema.sql';
    if (!file_exists($sqlFile)) {
        die("Error: SQL file not found: $sqlFile\n");
    }

    $sql = file_get_contents($sqlFile);
    
    echo "Executing migration...\n";
    // Split by semicolon to execute statements individually if needed, 
    // but PDO::exec can handle multiple statements if the driver supports it.
    // However, for robust migration, it's often safer to run the whole block 
    // or split. Since we have START TRANSACTION / COMMIT, we should try to run it as one block 
    // or ensure the driver allows multiple queries.
    // MySQL driver usually allows multiple queries if emulated prepares are on or specific flags are set,
    // but standard PDO might stop after the first one if not configured.
    // Let's try executing the whole string.
    
    $pdo->exec($sql);
    
    echo "Migration completed successfully.\n";

} catch (Throwable $e) {
    echo "Migration failed: " . $e->getMessage() . "\n";
    exit(1);
}
