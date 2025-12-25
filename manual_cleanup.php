<?php
// Manual Database Cleanup Script
// This script does NOT use config.php to avoid CLI environment issues.

// --- CONFIGURATION ---
$DB_HOST = 'localhost';
$DB_NAME = 'mini_erp';
$DB_USER = 'root';        // Try 'root' for AppServ default
$DB_PASS = '12345678';    // Try '12345678' for AppServ default

// If your local setup uses different creds, please edit lines above!
// ---------------------

function logMsg($msg) {
    echo $msg . "\n";
}

try {
    $dsn = "mysql:host=$DB_HOST;dbname=$DB_NAME;charset=utf8mb4";
    $pdo = new PDO($dsn, $DB_USER, $DB_PASS);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    logMsg("Connected to database ($DB_NAME) as $DB_USER.");

    // 1. Check current count
    $stmt = $pdo->query("SELECT COUNT(*) FROM address_sub_districts");
    $beforeCount = $stmt->fetchColumn();
    logMsg("Current records: $beforeCount");

    // 2. Create Temp Table 
    $pdo->exec("DROP TABLE IF EXISTS address_sub_districts_temp");
    // Manual Create to ignore indexes (we just want structure + data)
    // Or just LIKE
    $pdo->exec("CREATE TABLE address_sub_districts_temp LIKE address_sub_districts");
    logMsg("Created temporary table.");

    // 3. Add UNIQUE index to enforce deduplication on (id, zip_code)
    try {
        $pdo->exec("ALTER TABLE address_sub_districts_temp ADD UNIQUE INDEX unique_id_zip (id, zip_code)");
    } catch (PDOException $e) {
        logMsg("Notice: " . $e->getMessage());
    }

    // 4. Copy data with deduplication
    logMsg("Copying data (removing duplicates)...");
    $pdo->exec("INSERT IGNORE INTO address_sub_districts_temp SELECT * FROM address_sub_districts");

    $stmt = $pdo->query("SELECT COUNT(*) FROM address_sub_districts_temp");
    $tempCount = $stmt->fetchColumn();
    
    $removed = $beforeCount - $tempCount;
    logMsg("Records after deduplication: $tempCount");
    logMsg("Duplicates removed: $removed");

    if ($removed > 0) {
        // 5. Replace data
        logMsg("Truncating original table...");
        $pdo->exec("TRUNCATE TABLE address_sub_districts");
        
        logMsg("Restoring clean data...");
        $pdo->exec("INSERT INTO address_sub_districts SELECT * FROM address_sub_districts_temp");
        
        logMsg("Cleanup complete successfully.");
    } else {
        logMsg("No duplicates found. Table is already clean.");
    }

    // 6. Cleanup temp
    $pdo->exec("DROP TABLE address_sub_districts_temp");

} catch (PDOException $e) {
    logMsg("Error: " . $e->getMessage());
    logMsg("Hint: Check the \$DB_USER and \$DB_PASS at the top of this file.");
}
?>
