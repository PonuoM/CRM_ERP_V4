<?php
require_once '../config.php';

try {
    $conn = db_connect();
    
    // Drop existing table
    $conn->exec("DROP TABLE IF EXISTS marketing_product_ads_log");
    echo "Dropped old table.\n";
    
    // Read and execute new schema
    $sql = file_get_contents('create_product_ads_data_table.sql');
    $conn->exec($sql);
    echo "Created new table.\n";
    
} catch(PDOException $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
?>
