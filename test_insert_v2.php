<?php
require_once __DIR__ . '/api/config.php';

try {
    $pdo = db_connect();
    
    // Test Case 1: Huge Number as Ref ID
    $refId = '99999999999999999999';
    $phone = '08' . rand(10000000, 99999999);
    
    echo "Test 1: Insert with Huge Ref ID ($refId)\n";
    insert_customer($pdo, $refId, $phone);

    // Test 2: Long String
    $refId = str_repeat('A', 60);
    $phone = '08' . rand(10000000, 99999999);
    echo "Test 2: Insert with Long String Ref ID\n";
    insert_customer($pdo, $refId, $phone);

} catch (Exception $e) {
    echo "Test Failed: " . $e->getMessage() . "\n";
}

function insert_customer($pdo, $refId, $phone) {
    $stmt = $pdo->prepare('INSERT INTO customers (
        customer_ref_id, first_name, last_name, phone, company_id, 
        assigned_to, date_assigned, total_purchases, total_calls
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    
    try {
        $stmt->execute([
            $refId, 'TestFuzz', 'TestLast', $phone, 1, null, date('Y-m-d'), 0, 0
        ]);
        echo "Success: " . $pdo->lastInsertId() . "\n";
    } catch (Exception $e) {
        echo "Error: " . $e->getMessage() . "\n";
    }
}
