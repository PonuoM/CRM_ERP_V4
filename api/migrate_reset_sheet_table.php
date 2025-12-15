<?php
require_once __DIR__ . '/config.php';

try {
    $pdo = db_connect();
    
    // Drop table to reset data and schema
    $pdo->exec("DROP TABLE IF EXISTS `google_sheet_shipping`");
    
    // Read SQL file
    $sql = file_get_contents(__DIR__ . '/Database/google_sheet_shipping.sql');
    if (!$sql) {
        die("Error: Cannot read SQL file");
    }
    
    // Execute SQL
    $pdo->exec($sql);
    
    echo "Successfully reset table `google_sheet_shipping` with new schema (row_index).\n";
    
} catch (PDOException $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
