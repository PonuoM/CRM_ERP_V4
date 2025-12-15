<?php
// Test script to verify accounting_update_order_status
$url = 'http://localhost:5173/api/index.php/accounting_update_order_status';
$data = ['orderId' => 999999, 'status' => 'Claiming', 'note' => 'Test Note']; // Use a dummy ID, check for specific error or success

$options = [
    'http' => [
        'header'  => "Content-type: application/json\r\n",
        'method'  => 'POST',
        'content' => json_encode($data),
        'ignore_errors' => true // Fetch content even on 4xx/5xx
    ]
];
$context  = stream_context_create($options);
$result = file_get_contents($url, false, $context);
$headers = $http_response_header;

echo "Response Headers:\n";
print_r($headers);
echo "\nResponse Body:\n";
echo $result;
