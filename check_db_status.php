<?php
require_once __DIR__ . '/api/config.php';

try {
    $pdo = db_connect();
    
    // Check column info
    echo "--- Column Info ---\n";
    $stmt = $pdo->query("SHOW COLUMNS FROM customers LIKE 'customer_id'");
    $col = $stmt->fetch(PDO::FETCH_ASSOC);
    print_r($col);

    // Check table info (Auto_increment)
    echo "\n--- Table Info ---\n";
    $stmt = $pdo->query("SHOW TABLE STATUS LIKE 'customers'");
    $table = $stmt->fetch(PDO::FETCH_ASSOC);
    print_r($table);

    // If auto_increment is close to max of signed INT (2147483647)
    // or signed SMALLINT (32767)
    
    echo "\n--- Max ID ---\n";
    $stmt = $pdo->query("SELECT MAX(customer_id) as max_id FROM customers");
    $max = $stmt->fetch(PDO::FETCH_ASSOC);
    print_r($max);
    
    // Also check customer_ref_id type
    echo "\n--- Customer Ref ID Column Info ---\n";
    $stmt = $pdo->query("SHOW COLUMNS FROM customers LIKE 'customer_ref_id'");
    print_r($stmt->fetch(PDO::FETCH_ASSOC));

} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
