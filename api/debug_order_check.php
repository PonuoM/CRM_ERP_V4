<?php
/**
 * Debug Script: Check Order Details for Marketing Dashboard
 * Upload this file to production server and run via browser
 * URL: https://www.prima49.com/mini_erp/api/debug_order_check.php
 */

header("Content-Type: text/plain; charset=utf-8");

require_once __DIR__ . '/config.php';

$pdo = db_connect();

$orderId = '260102-00015wrnpx';
$companyId = 2;
$targetDate = '2026-01-02';

echo "========================================\n";
echo "  ORDER DEBUG REPORT\n";
echo "  Generated: " . date('Y-m-d H:i:s') . "\n";
echo "========================================\n\n";

// 1. Find the specific order
echo "=== 1. SEARCHING ORDER: $orderId ===\n";
$sql = "SELECT * FROM orders WHERE id = ?";
$stmt = $pdo->prepare($sql);
$stmt->execute([$orderId]);
$order = $stmt->fetch(PDO::FETCH_ASSOC);

if ($order) {
    echo "✓ Order FOUND!\n\n";
    echo "ID: " . $order['id'] . "\n";
    echo "Order Date (raw): " . $order['order_date'] . "\n";
    echo "Total Amount: " . number_format($order['total_amount'], 2) . "\n";
    echo "Order Status: " . $order['order_status'] . "\n";
    echo "Company ID: " . $order['company_id'] . "\n";
    echo "Sales Channel: " . $order['sales_channel'] . "\n";
    echo "Sales Channel Page ID: " . ($order['sales_channel_page_id'] ?? 'NULL/EMPTY') . "\n";
    echo "Creator ID: " . $order['creator_id'] . "\n";
    echo "Customer ID: " . $order['customer_id'] . "\n";
    echo "Customer Type: " . ($order['customer_type'] ?? 'NULL') . "\n";
    
    // Check the page
    echo "\n=== 2. PAGE CHECK ===\n";
    if (!empty($order['sales_channel_page_id'])) {
        $sql2 = "SELECT id, name, company_id, platform, active FROM pages WHERE id = ?";
        $stmt2 = $pdo->prepare($sql2);
        $stmt2->execute([$order['sales_channel_page_id']]);
        $page = $stmt2->fetch(PDO::FETCH_ASSOC);
        
        if ($page) {
            echo "✓ Page Found!\n";
            echo "Page ID: " . $page['id'] . "\n";
            echo "Page Name: " . $page['name'] . "\n";
            echo "Page Company ID: " . $page['company_id'] . "\n";
            echo "Platform: " . $page['platform'] . "\n";
            echo "Active: " . ($page['active'] ? 'Yes' : 'No') . "\n";
        } else {
            echo "✗ Page ID " . $order['sales_channel_page_id'] . " NOT FOUND!\n";
        }
    } else {
        echo "⚠ sales_channel_page_id is NULL or EMPTY!\n";
        echo "This is WHY the order doesn't show in Marketing Dashboard!\n";
    }
    
    // Date analysis
    echo "\n=== 3. DATE ANALYSIS ===\n";
    $orderDateOnly = date('Y-m-d', strtotime($order['order_date']));
    echo "Order Date (date only): $orderDateOnly\n";
    echo "Target Date: $targetDate\n";
    echo "Match: " . ($orderDateOnly === $targetDate ? 'YES ✓' : 'NO ✗') . "\n";
    
} else {
    echo "✗ Order NOT FOUND!\n";
}

// 2. Count all orders for company 2 on target date
echo "\n=== 4. ALL ORDERS FOR COMPANY $companyId ON $targetDate ===\n";
$sql3 = "SELECT 
    COUNT(*) as total_orders,
    SUM(total_amount) as total_sales,
    SUM(CASE WHEN sales_channel_page_id IS NOT NULL AND sales_channel_page_id != '' THEN 1 ELSE 0 END) as orders_with_page,
    SUM(CASE WHEN sales_channel_page_id IS NULL OR sales_channel_page_id = '' THEN 1 ELSE 0 END) as orders_without_page
FROM orders 
WHERE company_id = ? AND DATE(order_date) = ?";
$stmt3 = $pdo->prepare($sql3);
$stmt3->execute([$companyId, $targetDate]);
$stats = $stmt3->fetch(PDO::FETCH_ASSOC);

echo "Total Orders: " . $stats['total_orders'] . "\n";
echo "Total Sales: " . number_format($stats['total_sales'], 2) . "\n";
echo "Orders WITH Page ID: " . $stats['orders_with_page'] . "\n";
echo "Orders WITHOUT Page ID: " . $stats['orders_without_page'] . " ⚠ These won't show in Marketing!\n";

// 3. List all orders on that date
echo "\n=== 5. ORDER LIST (Company $companyId, Date $targetDate) ===\n";
$sql4 = "SELECT id, order_date, total_amount, order_status, sales_channel_page_id, sales_channel 
         FROM orders 
         WHERE company_id = ? AND DATE(order_date) = ?
         ORDER BY order_date DESC";
$stmt4 = $pdo->prepare($sql4);
$stmt4->execute([$companyId, $targetDate]);
$orders = $stmt4->fetchAll(PDO::FETCH_ASSOC);

if (!empty($orders)) {
    foreach ($orders as $o) {
        $pageStatus = (!empty($o['sales_channel_page_id'])) ? "Page:{$o['sales_channel_page_id']}" : "NO PAGE!";
        echo "- {$o['id']} | {$o['order_date']} | ฿" . number_format($o['total_amount'], 2) . " | {$o['order_status']} | {$o['sales_channel']} | $pageStatus\n";
    }
} else {
    echo "No orders found.\n";
}

echo "\n========================================\n";
echo "  END OF REPORT\n";
echo "========================================\n";
