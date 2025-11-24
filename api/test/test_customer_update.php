<?php
require_once __DIR__ . '/config.php';

try {
    $pdo = db_connect();
    
    // 1. Create a test customer
    $phone = '0999999999';
    $newPhone = '0888888888';
    $companyId = 1;
    
    // Cleanup first
    $pdo->prepare("DELETE FROM customers WHERE phone IN (?, ?) AND company_id = ?")->execute([$phone, $newPhone, $companyId]);
    
    echo "Creating customer with phone $phone...\n";
    $stmt = $pdo->prepare("INSERT INTO customers (first_name, last_name, phone, company_id, date_assigned, customer_ref_id) VALUES ('Test', 'User', ?, ?, NOW(), ?)");
    // We manually set customer_ref_id initially to see if it gets overwritten or if we need to provide it
    $initialRefId = "CUS-$phone-$companyId";
    $stmt->execute([$phone, $companyId, $initialRefId]);
    $id = $pdo->lastInsertId(); // This might be 0 if ID is not auto-increment or if it's the VARCHAR ID... wait, ID is INT but is it Auto Inc?
    
    // Check ID
    if ($id == 0) {
        // Maybe it's not auto-increment? Let's fetch it.
        $stmt = $pdo->prepare("SELECT customer_id, customer_ref_id FROM customers WHERE phone = ? AND company_id = ?");
        $stmt->execute([$phone, $companyId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        $id = $row['customer_id'];
        echo "Created Customer ID: $id\n";
        echo "Initial Ref ID: " . $row['customer_ref_id'] . "\n";
    } else {
        echo "Created Customer ID: $id\n";
    }

    // 2. Update phone
    echo "Updating phone to $newPhone...\n";
    $stmt = $pdo->prepare("UPDATE customers SET phone = ? WHERE customer_id = ?");
    $stmt->execute([$newPhone, $id]);
    
    // 3. Check result
    $stmt = $pdo->prepare("SELECT customer_ref_id FROM customers WHERE customer_id = ?");
    $stmt->execute([$id]);
    $newRefId = $stmt->fetchColumn();
    
    echo "New Ref ID: $newRefId\n";
    
    if ($newRefId === "CUS-$newPhone-$companyId") {
        echo "RESULT: customer_ref_id UPDATED automatically.\n";
    } else if ($newRefId === $initialRefId) {
        echo "RESULT: customer_ref_id DID NOT update.\n";
    } else {
        echo "RESULT: customer_ref_id changed to something else: $newRefId\n";
    }

    // Cleanup
    $pdo->prepare("DELETE FROM customers WHERE customer_id = ?")->execute([$id]);

} catch (Throwable $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
