<?php
// Trigger reprocess on PRODUCTION via curl
$url = 'https://www.prima49.com/beta_test/api/inv2/reprocess_pending_dispatch.php';
$data = json_encode([
    'company_id' => 2,
    'dispatch_warehouse_name' => 'Center - กาญจนบุรี'
]);

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $data);
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
curl_setopt($ch, CURLOPT_TIMEOUT, 300); // 5 min timeout for large batch
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);

echo "Calling reprocess API on production...\n";
echo "URL: $url\n";
echo "Payload: $data\n\n";

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$error = curl_error($ch);
curl_close($ch);

echo "HTTP Code: $httpCode\n";
if ($error) echo "CURL Error: $error\n";
echo "Response: $response\n";
