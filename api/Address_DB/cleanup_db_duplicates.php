<?php
require_once __DIR__ . '/../../config.php';

header('Content-Type: application/json');

function logMsg($msg) {
    echo $msg . "\n";
}

try {
    $pdo = db_connect();
    logMsg("Connected to database.");

    // 1. Check current count
    $stmt = $pdo->query("SELECT COUNT(*) FROM address_sub_districts");
    $beforeCount = $stmt->fetchColumn();
    logMsg("Current records: $beforeCount");

    // 2. Create Temp Table with the structure of the original
    // usage of CREATE TABLE ... LIKE copies structure (columns, but indexes might be copied too, which is fine)
    // But we assume the original has NO unique constraint on ID as per user statement.
    $pdo->exec("DROP TABLE IF EXISTS address_sub_districts_temp");
    $pdo->exec("CREATE TABLE address_sub_districts_temp LIKE address_sub_districts");
    logMsg("Created temporary table.");

    // 3. Add UNIQUE index to temp table on (id, zip_code) to enforce deduplication logic
    // We strictly want ONE record per (id, zip_code).
    // Note: If multiple records exist being exact duplicates, INSERT IGNORE will keep the first one encountered.
    // If they differ in other fields (like name spelling), the first one wins.
    try {
        $pdo->exec("ALTER TABLE address_sub_districts_temp ADD UNIQUE INDEX unique_id_zip (id, zip_code)");
    } catch (PDOException $e) {
        // Index might already exist if copied from source? Unlikely given user context.
        logMsg("Notice on adding index: " . $e->getMessage());
    }

    // 4. Copy data with deduplication
    logMsg("Copying data to temp table...");
    $pdo->exec("INSERT IGNORE INTO address_sub_districts_temp SELECT * FROM address_sub_districts");

    $stmt = $pdo->query("SELECT COUNT(*) FROM address_sub_districts_temp");
    $tempCount = $stmt->fetchColumn();
    logMsg("Records after deduplication: $tempCount");
    logMsg("Duplicates removed: " . ($beforeCount - $tempCount));

    if ($tempCount < $beforeCount) {
        // 5. Replace data in original table
        // We truncate original and insert back from temp to preserve original table schema exactly (without the added unique index if we want to be conservative)
        // OR we can keep the index if the user wants to prevent duplicates in future.
        // Given the user instructions about "Drop uniq", maybe they prefer NO constraints on the main table for some reason?
        // But preventing exact duplicates (full row or key fields) is usually desired.
        // I will Restore data to original table structure.
        
        logMsg("Truncating original table...");
        $pdo->exec("TRUNCATE TABLE address_sub_districts");
        
        logMsg("Restoring clean data...");
        $pdo->exec("INSERT INTO address_sub_districts SELECT * FROM address_sub_districts_temp");
        
        logMsg("Cleanup complete successfully.");
    } else {
        logMsg("No duplicates found to remove.");
    }

    // 6. Cleanup temp
    $pdo->exec("DROP TABLE address_sub_districts_temp");

} catch (PDOException $e) {
    logMsg("Error: " . $e->getMessage());
    // Try to cleanup temp if exists
    try { $pdo->exec("DROP TABLE IF EXISTS address_sub_districts_temp"); } catch (Exception $ex) {}
}
?>
