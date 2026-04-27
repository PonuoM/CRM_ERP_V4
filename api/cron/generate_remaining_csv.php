<?php
ini_set('memory_limit', '512M');
$conn = new mysqli('202.183.192.218', 'primacom_bloguser', 'pJnL53Wkhju2LaGPytw8', 'primacom_mini_erp');
$conn->set_charset("utf8mb4");

$csvFile = __DIR__ . '/../../duplicate_customers_REMAINING_833.csv';
$fp = fopen($csvFile, 'w');

// Write dummy header to match index
fputcsv($fp, ['Group ID', 'col1', 'col2', 'col3', 'col4', 'col5', 'col6', 'col7', 'col8', 'Customer ID']);

echo "Fetching duplicate groups...\n";
$res = $conn->query("
    SELECT first_name, last_name, province, company_id
    FROM customers 
    GROUP BY first_name, last_name, province, company_id 
    HAVING COUNT(*) > 1
");

$dupGroups = [];
$groupId = 1;
while ($row = $res->fetch_assoc()) {
    $key = $row['first_name'] . '|' . $row['last_name'] . '|' . $row['province'] . '|' . $row['company_id'];
    $dupGroups[$key] = $groupId++;
}

echo "Found " . count($dupGroups) . " duplicate groups. Fetching all customers...\n";

// Now fetch all customers and check if they belong to any dup group
// To save memory, only fetch those that might match (this still does full scan but returns less data)
$res = $conn->query("SELECT customer_id, first_name, last_name, province, company_id FROM customers");

$count = 0;
while ($row = $res->fetch_assoc()) {
    $key = $row['first_name'] . '|' . $row['last_name'] . '|' . $row['province'] . '|' . $row['company_id'];
    if (isset($dupGroups[$key])) {
        fputcsv($fp, [
            $dupGroups[$key], '', '', '', '', '', '', '', '', $row['customer_id']
        ]);
        $count++;
    }
}

fclose($fp);
echo "Generated CSV with " . count($dupGroups) . " groups and $count total customers.\n";
