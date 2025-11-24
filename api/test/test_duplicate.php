<?php
require_once __DIR__ . '/config.php';

try {
    $pdo = db_connect();
    
    $phone = '0999999999';
    $companyId = 1;
    
    // Cleanup
    $pdo->prepare("DELETE FROM customers WHERE phone = ? AND company_id = ?")->execute([$phone, $companyId]);
    
    echo "1. Creating first customer...\n";
    $stmt = $pdo->prepare("INSERT INTO customers (first_name, last_name, phone, company_id, date_assigned, customer_ref_id) VALUES ('Test1', 'User1', ?, ?, NOW(), ?)");
    $stmt->execute([$phone, $companyId, "CUS-$phone-$companyId"]);
    echo "First customer created.\n";
    
    echo "2. Attempting to create second customer with SAME phone...\n";
    try {
        $stmt = $pdo->prepare("INSERT INTO customers (first_name, last_name, phone, company_id, date_assigned, customer_ref_id) VALUES ('Test2', 'User2', ?, ?, NOW(), ?)");
        // Note: We might not even need to provide customer_ref_id if the trigger generates it.
        // But let's try providing it to see if Unique Key catches it.
        // Actually, if trigger overwrites it, it will generate the SAME ID.
        $stmt->execute([$phone, $companyId, "CUS-$phone-$companyId"]);
        echo "ERROR: Duplicate created! (Should have failed)\n";
    } catch (PDOException $e) {
        if ($e->getCode() == 23000) {
            echo "SUCCESS: Caught duplicate error: " . $e->getMessage() . "\n";
        } else {
            echo "ERROR: Caught unexpected error: " . $e->getMessage() . "\n";
        }
    }

    // Cleanup
    $pdo->prepare("DELETE FROM customers WHERE phone = ? AND company_id = ?")->execute([$phone, $companyId]);

} catch (Throwable $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
