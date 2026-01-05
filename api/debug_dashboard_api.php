<?php
/**
 * Debug: Simulate Marketing Dashboard API Call
 * Check what data is returned for the date range
 */

header("Content-Type: text/plain; charset=utf-8");

require_once __DIR__ . '/config.php';

$pdo = db_connect();

$companyId = 2;
$dateFrom = '2026-01-02';
$dateTo = '2026-01-02';

echo "========================================\n";
echo "  MARKETING DASHBOARD API DEBUG\n";
echo "  Company: $companyId\n";
echo "  Date Range: $dateFrom to $dateTo\n";
echo "  Generated: " . date('Y-m-d H:i:s') . "\n";
echo "========================================\n\n";

// Simulate the dashboard_data.php query
$query = "
    SELECT
        p.id as page_id,
        p.name as page_name,
        p.platform,
        p.page_type,
        COALESCE(SUM(mal.ads_cost), 0) as ads_cost,
        COALESCE(SUM(o.total_amount), 0) as total_sales,
        COALESCE(COUNT(DISTINCT o.id), 0) as total_orders,
        COALESCE(COUNT(DISTINCT o.customer_id), 0) as total_customers
    FROM pages p
    LEFT JOIN (
        SELECT * FROM marketing_ads_log
        WHERE date BETWEEN ? AND ?
    ) mal ON p.id = mal.page_id
    LEFT JOIN (
        SELECT * FROM orders
        WHERE order_date BETWEEN ? AND ?
    ) o ON p.id = o.sales_channel_page_id
    WHERE p.company_id = ?
    GROUP BY p.id, p.name, p.platform, p.page_type
    ORDER BY p.name ASC
";

$stmt = $pdo->prepare($query);
$stmt->execute([$dateFrom, $dateTo, $dateFrom, $dateTo, $companyId]);
$data = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo "=== RESULTS FROM DASHBOARD QUERY ===\n\n";

$grandTotalSales = 0;
$grandTotalOrders = 0;

foreach ($data as $row) {
    echo "Page: {$row['page_name']} (ID: {$row['page_id']})\n";
    echo "  Platform: {$row['platform']}\n";
    echo "  Ads Cost: " . number_format($row['ads_cost'], 2) . "\n";
    echo "  Total Sales: " . number_format($row['total_sales'], 2) . "\n";
    echo "  Total Orders: {$row['total_orders']}\n";
    echo "  Total Customers: {$row['total_customers']}\n";
    echo "\n";
    
    $grandTotalSales += $row['total_sales'];
    $grandTotalOrders += $row['total_orders'];
}

echo "=== GRAND TOTAL ===\n";
echo "Total Sales: " . number_format($grandTotalSales, 2) . "\n";
echo "Total Orders: $grandTotalOrders\n";

// Check if there's a date format issue
echo "\n=== DATE FORMAT CHECK ===\n";

// Check with DATETIME format
$query2 = "SELECT COUNT(*) as cnt, SUM(total_amount) as sales 
           FROM orders 
           WHERE company_id = ? 
           AND order_date >= ? AND order_date < ?";
$stmt2 = $pdo->prepare($query2);
$nextDay = date('Y-m-d', strtotime($dateTo . ' +1 day'));
$stmt2->execute([$companyId, $dateFrom, $nextDay]);
$check = $stmt2->fetch(PDO::FETCH_ASSOC);

echo "Query: order_date >= '$dateFrom' AND order_date < '$nextDay'\n";
echo "Result: {$check['cnt']} orders, " . number_format($check['sales'], 2) . " sales\n";

// Check with BETWEEN on full datetime
$query3 = "SELECT COUNT(*) as cnt, SUM(total_amount) as sales 
           FROM orders 
           WHERE company_id = ? 
           AND order_date BETWEEN ? AND ?";
$stmt3 = $pdo->prepare($query3);
$stmt3->execute([$companyId, $dateFrom . ' 00:00:00', $dateTo . ' 23:59:59']);
$check2 = $stmt3->fetch(PDO::FETCH_ASSOC);

echo "\nQuery: order_date BETWEEN '$dateFrom 00:00:00' AND '$dateTo 23:59:59'\n";
echo "Result: {$check2['cnt']} orders, " . number_format($check2['sales'], 2) . " sales\n";

// Check BETWEEN date only (this is what dashboard uses)
$query4 = "SELECT COUNT(*) as cnt, SUM(total_amount) as sales 
           FROM orders 
           WHERE company_id = ? 
           AND order_date BETWEEN ? AND ?";
$stmt4 = $pdo->prepare($query4);
$stmt4->execute([$companyId, $dateFrom, $dateTo]);
$check3 = $stmt4->fetch(PDO::FETCH_ASSOC);

echo "\nQuery: order_date BETWEEN '$dateFrom' AND '$dateTo' (date only - PROBLEM!)\n";
echo "Result: {$check3['cnt']} orders, " . number_format($check3['sales'], 2) . " sales\n";

if ($check3['cnt'] == 0 && $check2['cnt'] > 0) {
    echo "\n⚠️ ISSUE FOUND: BETWEEN with date-only misses orders with time!\n";
    echo "Dashboard query uses 'BETWEEN $dateFrom AND $dateTo' without time.\n";
    echo "Orders have datetime like '2026-01-02 19:35:31'.\n";
    echo "BETWEEN '2026-01-02' AND '2026-01-02' = BETWEEN '2026-01-02 00:00:00' AND '2026-01-02 00:00:00'\n";
    echo "This EXCLUDES orders with time > 00:00:00!\n";
}

echo "\n========================================\n";
echo "  END OF DEBUG\n";
echo "========================================\n";
