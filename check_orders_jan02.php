<?php
require_once 'api/config.php';

$pdo = db_connect();

$companyId = 2;
$targetDate = '2026-01-02';

echo "=== Checking Orders for Company $companyId on $targetDate ===\n\n";

// 1. Count all orders on that date for the company
$sql = "SELECT COUNT(*) as total, 
        SUM(total_amount) as total_sales,
        GROUP_CONCAT(DISTINCT order_status) as statuses
        FROM orders 
        WHERE company_id = ? AND DATE(order_date) = ?";
$stmt = $pdo->prepare($sql);
$stmt->execute([$companyId, $targetDate]);
$result = $stmt->fetch(PDO::FETCH_ASSOC);

echo "Total Orders: " . $result['total'] . "\n";
echo "Total Sales: " . number_format($result['total_sales'], 2) . "\n";
echo "Statuses Found: " . $result['statuses'] . "\n\n";

// 2. Check if sales_channel_page_id is set
$sql2 = "SELECT 
    sales_channel_page_id,
    COUNT(*) as count,
    SUM(total_amount) as sales
FROM orders 
WHERE company_id = ? AND DATE(order_date) = ?
GROUP BY sales_channel_page_id";
$stmt2 = $pdo->prepare($sql2);
$stmt2->execute([$companyId, $targetDate]);
$rows = $stmt2->fetchAll(PDO::FETCH_ASSOC);

echo "=== Orders by Page ID ===\n";
foreach ($rows as $row) {
    $pageId = $row['sales_channel_page_id'] ?? 'NULL';
    echo "Page ID: $pageId | Orders: {$row['count']} | Sales: " . number_format($row['sales'], 2) . "\n";
}

// 3. List individual orders
echo "\n=== Order Details ===\n";
$sql3 = "SELECT id, order_date, total_amount, order_status, sales_channel_page_id, creator_id 
         FROM orders 
         WHERE company_id = ? AND DATE(order_date) = ?
         ORDER BY order_date DESC
         LIMIT 20";
$stmt3 = $pdo->prepare($sql3);
$stmt3->execute([$companyId, $targetDate]);
$orders = $stmt3->fetchAll(PDO::FETCH_ASSOC);

foreach ($orders as $o) {
    echo "ID: {$o['id']} | Date: {$o['order_date']} | Amount: " . number_format($o['total_amount'], 2) . 
         " | Status: {$o['order_status']} | PageID: " . ($o['sales_channel_page_id'] ?? 'NULL') . 
         " | Creator: {$o['creator_id']}\n";
}

if (empty($orders)) {
    echo "No orders found for this date!\n";
}

echo "\nDone.\n";
