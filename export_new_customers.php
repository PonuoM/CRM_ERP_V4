<?php
$conn = new mysqli('127.0.0.1', 'root', '12345678', 'mini_erp');
$conn->set_charset("utf8mb4");

if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

$query = "
SELECT 
    DATE_FORMAT(o.order_date, '%Y-%m') AS order_month,
    u.username AS employee_username,
    u.first_name AS employee_first_name,
    u.last_name AS employee_last_name,
    COUNT(DISTINCT c.customer_id) AS new_customer_count
FROM orders o
JOIN users u ON o.creator_id = u.id
JOIN customers c ON o.customer_id = c.customer_id
WHERE o.order_date >= '2026-01-01 00:00:00' 
  AND o.order_date <= '2026-05-31 23:59:59'
  AND o.id NOT LIKE '%EXTERNAL%'
  AND u.role_id IN (6, 7)
  AND o.company_id = 1
  AND NOT EXISTS (
      SELECT 1 
      FROM orders o2 
      WHERE o2.customer_id = o.customer_id 
        AND (o2.order_date < o.order_date OR (o2.order_date = o.order_date AND o2.id < o.id))
  )
GROUP BY order_month, u.id, u.username, u.first_name, u.last_name
ORDER BY order_month ASC, new_customer_count DESC;
";

$res = $conn->query($query);
if (!$res) {
    die("Query failed: " . $conn->error);
}

$filename = 'new_customers_report_company1.csv';
$fp = fopen($filename, 'w');

// Add UTF-8 BOM for Excel to read Thai correctly
fputs($fp, chr(0xEF) . chr(0xBB) . chr(0xBF));

// Headers
fputcsv($fp, ['เดือน (Year-Month)', 'Username', 'ชื่อ', 'นามสกุล', 'จำนวนลูกค้าใหม่']);

while ($row = $res->fetch_assoc()) {
    fputcsv($fp, [
        $row['order_month'],
        $row['employee_username'],
        $row['employee_first_name'],
        $row['employee_last_name'],
        $row['new_customer_count']
    ]);
}

fclose($fp);
echo "Generated $filename successfully.";
$conn->close();
