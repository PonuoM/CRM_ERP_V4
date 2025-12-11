require_once 'api/config.php';

// Helper function to make requests
function makeRequest($method, $url, $data = null) {
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, "http://localhost/CRM_ERP_V4/" . $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    if ($data) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    }
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return ['code' => $httpCode, 'body' => json_decode($response, true)];
}

// 1. Create a new order with customerType
echo "1. Creating new order with customerType...\n";
$orderId = 'ORD-' . time();
$payload = [
    'id' => $orderId,
    'customerId' => 'CUS-TEST-001', // Assuming this customer exists or will be handled
    'companyId' => 1,
    'creatorId' => 1, // Assuming user ID 1 exists
    'orderDate' => date('Y-m-d H:i:s'),
    'deliveryDate' => date('Y-m-d'),
    'totalAmount' => 100,
    'customerType' => 'New Customer',
    'items' => [
        [
            'productId' => 1,
            'productName' => 'Test Product',
            'quantity' => 1,
            'pricePerUnit' => 100,
            'boxNumber' => 1
        ]
    ]
];

$response = makeRequest('POST', 'api/orders', $payload);
echo "Response Code: " . $response['code'] . "\n";
print_r($response['body']);

if ($response['code'] === 200 && ($response['body']['ok'] ?? false)) {
    echo "Order created successfully.\n";
    
    // Verify database
    $pdo = db_connect();
    $stmt = $pdo->prepare("SELECT customer_type FROM orders WHERE id = ?");
    $stmt->execute([$orderId]);
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    echo "Database customer_type: " . ($result['customer_type'] ?? 'NULL') . "\n";
    
    if ($result['customer_type'] === 'New Customer') {
        echo "PASS: customer_type saved correctly on creation.\n";
    } else {
        echo "FAIL: customer_type not saved correctly.\n";
    }

    // 2. Update order with new customerType
    echo "\n2. Updating order with new customerType...\n";
    $updatePayload = [
        'customerType' => 'Reorder'
    ];
    $updateResponse = makeRequest('PATCH', 'api/orders/' . $orderId, $updatePayload);
    echo "Response Code: " . $updateResponse['code'] . "\n";
    print_r($updateResponse['body']);
    
    // Verify database again
    $stmt->execute([$orderId]);
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    echo "Database customer_type after update: " . ($result['customer_type'] ?? 'NULL') . "\n";
    
    if ($result['customer_type'] === 'Reorder') {
        echo "PASS: customer_type updated correctly.\n";
    } else {
        echo "FAIL: customer_type not updated correctly.\n";
    }

} else {
    echo "FAIL: Order creation failed.\n";
}
