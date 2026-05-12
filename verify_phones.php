<?php
header('Content-Type: application/json; charset=utf-8');

// Read CSV file
$csvFile = __DIR__ . '/report_repeat_detail_alltime_v2.csv';
$rows = [];

if (($handle = fopen($csvFile, "r")) !== FALSE) {
    $header = fgetcsv($handle); // skip header
    while (($data = fgetcsv($handle)) !== FALSE) {
        if (empty($data[2])) continue; // skip empty customer_id
        
        // Parse phone: remove ="..." wrapper
        $phone_csv = $data[4] ?? '';
        $phone_csv = preg_replace('/^="?|"?$/', '', $phone_csv);
        $phone_csv = trim($phone_csv);
        
        $rows[] = [
            'telesale_id' => $data[0],
            'telesale_name' => $data[1],
            'customer_id' => (int)$data[2],
            'customer_name' => $data[3],
            'phone_csv' => $phone_csv,
        ];
    }
    fclose($handle);
}

// Get unique customer IDs
$customerIds = array_unique(array_column($rows, 'customer_id'));

// Connect to DB
$conn = new mysqli('202.183.192.218', 'primacom_bloguser', 'pJnL53Wkhju2LaGPytw8', 'primacom_mini_erp');
$conn->set_charset("utf8mb4");

if ($conn->connect_error) {
    die(json_encode(['error' => 'Connection failed: ' . $conn->connect_error]));
}

// Fetch phones from DB in batches
$dbPhones = [];
$chunks = array_chunk($customerIds, 200);

foreach ($chunks as $chunk) {
    $ids = implode(',', $chunk);
    $sql = "SELECT customer_id, phone, CONCAT(first_name, ' ', COALESCE(last_name,'')) as name_db FROM customers WHERE customer_id IN ($ids)";
    $result = $conn->query($sql);
    while ($row = $result->fetch_assoc()) {
        $dbPhones[$row['customer_id']] = [
            'phone_db' => trim($row['phone'] ?? ''),
            'name_db' => trim($row['name_db'] ?? '')
        ];
    }
}

$conn->close();

// Compare
$mismatches = [];
$matches = 0;
$not_found = [];

foreach ($rows as $r) {
    $cid = $r['customer_id'];
    $csvPhone = $r['phone_csv'];
    
    if (!isset($dbPhones[$cid])) {
        $not_found[] = $r;
        continue;
    }
    
    $dbPhone = $dbPhones[$cid]['phone_db'];
    
    // Normalize: remove leading 0 for comparison
    $csvNorm = ltrim($csvPhone, '0');
    $dbNorm = ltrim($dbPhone, '0');
    
    if ($csvNorm === $dbNorm) {
        $matches++;
    } else {
        $mismatches[] = [
            'customer_id' => $cid,
            'customer_name' => $r['customer_name'],
            'telesale' => $r['telesale_name'],
            'phone_csv' => $csvPhone,
            'phone_db' => $dbPhone,
            'name_db' => $dbPhones[$cid]['name_db']
        ];
    }
}

echo json_encode([
    'total_csv_rows' => count($rows),
    'total_unique_customers' => count($customerIds),
    'matches' => $matches,
    'mismatches_count' => count($mismatches),
    'not_found_count' => count($not_found),
    'mismatches' => $mismatches,
    'not_found' => $not_found
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
