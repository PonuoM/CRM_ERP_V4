<?php
require_once 'api/config.php';

try {
    $pdo = db_connect();
    
    // Check table schema
    $stmt = $pdo->query("SHOW CREATE TABLE address_sub_districts");
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    print_r($result);

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
?>
