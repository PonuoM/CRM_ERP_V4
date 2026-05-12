<?php
header('Content-Type: application/json; charset=utf-8');

$csvFile = __DIR__ . '/report_repeat_detail_alltime_v2.csv';
$rows = [];

if (($handle = fopen($csvFile, "r")) !== FALSE) {
    $header = fgetcsv($handle);
    while (($data = fgetcsv($handle)) !== FALSE) {
        if (empty($data[2])) continue;
        $rows[] = [
            'telesale_id_csv' => (int)$data[0],
            'telesale_name_csv' => $data[1],
            'customer_id' => (int)$data[2],
            'customer_name' => $data[3],
        ];
    }
    fclose($handle);
}

$customerIds = array_unique(array_column($rows, 'customer_id'));

$conn = new mysqli('202.183.192.218', 'primacom_bloguser', 'pJnL53Wkhju2LaGPytw8', 'primacom_mini_erp');
$conn->set_charset("utf8mb4");

// Fetch assigned_to from DB
$dbData = [];
$chunks = array_chunk($customerIds, 200);
foreach ($chunks as $chunk) {
    $ids = implode(',', $chunk);
    $sql = "SELECT c.customer_id, c.assigned_to, 
                   CONCAT(c.first_name, ' ', COALESCE(c.last_name,'')) as customer_name_db,
                   u.first_name as telesale_name_db
            FROM customers c
            LEFT JOIN users u ON u.user_id = c.assigned_to
            WHERE c.customer_id IN ($ids)";
    $result = $conn->query($sql);
    if (!$result) {
        // Try with 'id' for users table
        $sql2 = "SELECT c.customer_id, c.assigned_to, 
                       CONCAT(c.first_name, ' ', COALESCE(c.last_name,'')) as customer_name_db
                FROM customers c
                WHERE c.customer_id IN ($ids)";
        $result = $conn->query($sql2);
    }
    while ($row = $result->fetch_assoc()) {
        $dbData[$row['customer_id']] = [
            'assigned_to_db' => (int)($row['assigned_to'] ?? 0),
            'customer_name_db' => trim($row['customer_name_db'] ?? ''),
            'telesale_name_db' => $row['telesale_name_db'] ?? null
        ];
    }
}

// Also get user names
$userIds = array_unique(array_column($dbData, 'assigned_to_db'));
$userNames = [];

// Check users table schema first
$descResult = $conn->query("SHOW COLUMNS FROM users LIKE '%id%'");
$idCol = 'user_id';

$userIdsStr = implode(',', array_filter($userIds));
if (!empty($userIdsStr)) {
    $sql = "SELECT user_id, first_name, COALESCE(last_name,'') as last_name, nickname FROM users WHERE user_id IN ($userIdsStr)";
    $result = $conn->query($sql);
    if ($result) {
        while ($row = $result->fetch_assoc()) {
            $userNames[$row['user_id']] = trim($row['nickname'] ?: ($row['first_name'] . ' ' . $row['last_name']));
        }
    }
}

$conn->close();

// Compare
$mismatches = [];
$matches = 0;

foreach ($rows as $r) {
    $cid = $r['customer_id'];
    $csvTelesaleId = $r['telesale_id_csv'];
    
    if (!isset($dbData[$cid])) continue;
    
    $dbAssignedTo = $dbData[$cid]['assigned_to_db'];
    
    if ($csvTelesaleId === $dbAssignedTo) {
        $matches++;
    } else {
        $mismatches[] = [
            'customer_id' => $cid,
            'customer_name' => $r['customer_name'],
            'csv_telesale_id' => $csvTelesaleId,
            'csv_telesale_name' => $r['telesale_name_csv'],
            'db_assigned_to' => $dbAssignedTo,
            'db_assigned_name' => $userNames[$dbAssignedTo] ?? '(unknown)',
        ];
    }
}

echo json_encode([
    'total_csv_rows' => count($rows),
    'matches' => $matches,
    'mismatches_count' => count($mismatches),
    'mismatches' => $mismatches
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
