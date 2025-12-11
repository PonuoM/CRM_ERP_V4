<?php
require_once __DIR__ . '/api/config.php';

function test_create_customer() {
    global $pdo;
    echo "Testing Create Customer...\n";
    
    $phone = '0999999999';
    $customerType = 'New Customer';
    
    // Cleanup first
    $stmt = $pdo->prepare("DELETE FROM customers WHERE phone = ?");
    $stmt->execute([$phone]);
    
    $url = 'http://localhost/CRM_ERP_V4/api/customers';
    $data = [
        'firstName' => 'Test',
        'lastName' => 'Customer',
        'phone' => $phone,
        'customerType' => $customerType,
        'companyId' => 1
    ];
    
    $options = [
        'http' => [
            'header'  => "Content-type: application/json\r\n",
            'method'  => 'POST',
            'content' => json_encode($data)
        ]
    ];
    $context  = stream_context_create($options);
    $result = file_get_contents($url, false, $context);
    $response = json_decode($result, true);
    
    if ($response && isset($response['id'])) {
        echo "Customer created with ID: " . $response['id'] . "\n";
        
        // Verify in DB
        $stmt = $pdo->prepare("SELECT customer_type FROM customers WHERE id = ?");
        $stmt->execute([$response['id']]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($row && $row['customer_type'] === $customerType) {
            echo "SUCCESS: customer_type is '$customerType'\n";
            return $response['id'];
        } else {
            echo "FAILURE: customer_type is '" . ($row['customer_type'] ?? 'NULL') . "', expected '$customerType'\n";
        }
    } else {
        echo "FAILURE: API request failed\n";
        print_r($response);
    }
    return null;
}

function test_update_customer($id) {
    global $pdo;
    echo "\nTesting Update Customer...\n";
    
    $customerType = 'Reorder';
    $url = 'http://localhost/CRM_ERP_V4/api/customers/' . $id;
    $data = [
        'customerType' => $customerType
    ];
    
    $options = [
        'http' => [
            'header'  => "Content-type: application/json\r\n",
            'method'  => 'PATCH',
            'content' => json_encode($data)
        ]
    ];
    $context  = stream_context_create($options);
    $result = file_get_contents($url, false, $context);
    $response = json_decode($result, true);
    
    if ($response && isset($response['ok']) && $response['ok']) {
        echo "Customer updated.\n";
        
        // Verify in DB
        $stmt = $pdo->prepare("SELECT customer_type FROM customers WHERE id = ?");
        $stmt->execute([$id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($row && $row['customer_type'] === $customerType) {
            echo "SUCCESS: customer_type is '$customerType'\n";
        } else {
            echo "FAILURE: customer_type is '" . ($row['customer_type'] ?? 'NULL') . "', expected '$customerType'\n";
        }
    } else {
        echo "FAILURE: API request failed\n";
        print_r($response);
    }
}

$id = test_create_customer();
if ($id) {
    test_update_customer($id);
    
    // Cleanup
    global $pdo;
    $stmt = $pdo->prepare("DELETE FROM customers WHERE id = ?");
    $stmt->execute([$id]);
    echo "\nCleanup completed.\n";
}
