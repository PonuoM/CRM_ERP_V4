<?php
require_once __DIR__ . '/../api/config.php';

try {
    $pdo = db_connect();
    // Try to select a customer using customer_id
    $stmt = $pdo->query("SELECT customer_id FROM customers LIMIT 1");
    $customerId = $stmt->fetchColumn();
    
    if ($customerId) {
        echo "Found customer_id: $customerId\n";
        
        // Test the fixed query
        $sql = "SELECT * FROM customers WHERE customer_id = ?";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$customerId]);
        $row = $stmt->fetch();
        
        if ($row) {
            echo "Successfully fetched customer using customer_id.\n";
        } else {
            echo "Failed to fetch customer using customer_id.\n";
        }
        
        // Test the OLD broken query to confirm it fails (optional, but good for sanity)
        try {
            $sql = "SELECT * FROM customers WHERE id = ?";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([$customerId]);
            echo "WARNING: The old query 'WHERE id = ?' actually worked! (This shouldn't happen if column is gone)\n";
        } catch (PDOException $e) {
            echo "Confirmed: Old query failed as expected: " . $e->getMessage() . "\n";
        }
        
    } else {
        echo "No customers found to test with.\n";
    }

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
