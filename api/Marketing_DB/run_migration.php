<?php
require_once '../config.php';

try {
    $conn = db_connect();
    $sql = file_get_contents('create_marketing_user_product_table.sql');
    $conn->exec($sql);
    echo "Table created successfully\n";
} catch(PDOException $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
?>
