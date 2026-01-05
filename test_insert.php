<?php
require_once __DIR__ . '/api/config.php';

try {
    $pdo = db_connect();
    
    // Simulate data from api/index.php
    $refId = 'CUS-TEST-' . rand(1000,9999);
    $phone = '08' . rand(10000000, 99999999);
    
    echo "Attempting to insert customer with refId: $refId\n";

    $stmt = $pdo->prepare('INSERT INTO customers (
        customer_ref_id, first_name, last_name, phone, company_id, 
        assigned_to, date_assigned, total_purchases, total_calls
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    
    $stmt->execute([
        $refId,
        'TestFirst',
        'TestLast',
        $phone,
        1, // Company ID
        null,
        date('Y-m-d H:i:s'),
        0,
        0
    ]);
    
    echo "Insert successful. New ID: " . $pdo->lastInsertId() . "\n";

} catch (Exception $e) {
    echo "Insert failed: " . $e->getMessage() . "\n";
    // echo $e->getTraceAsString();
}
