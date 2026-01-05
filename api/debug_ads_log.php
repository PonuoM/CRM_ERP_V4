<?php
/**
 * Debug: Check Page 34 (Company 1) Ads multiplication issue
 */

header("Content-Type: text/plain; charset=utf-8");

require_once __DIR__ . '/config.php';

$pdo = db_connect();

$pageId = 34;
$targetDate = '2026-01-02';
$dateFrom = '2026-01-02';
$dateTo = '2026-01-02';

echo "========================================\n";
echo "  ADS MULTIPLICATION DEBUG - Page 34\n";
echo "  Date: $targetDate\n";
echo "  Generated: " . date('Y-m-d H:i:s') . "\n";
echo "========================================\n\n";

// 1. Actual ads_log for Page 34
echo "=== ACTUAL ADS LOG FOR PAGE 34 ===\n";
$sql1 = "SELECT * FROM marketing_ads_log WHERE page_id = ? AND date = ?";
$stmt1 = $pdo->prepare($sql1);
$stmt1->execute([$pageId, $targetDate]);
$ads = $stmt1->fetchAll(PDO::FETCH_ASSOC);

$actualAdsTotal = 0;
foreach ($ads as $a) {
    echo "ID: {$a['id']} | Date: {$a['date']} | Cost: " . number_format($a['ads_cost'], 2) . "\n";
    $actualAdsTotal += $a['ads_cost'];
}
echo "Actual Total: " . number_format($actualAdsTotal, 2) . "\n";

// 2. Count orders for Page 34 on that date
echo "\n=== ORDERS FOR PAGE 34 ON $targetDate ===\n";
$sql2 = "SELECT COUNT(*) as order_count, SUM(total_amount) as total_sales 
         FROM orders 
         WHERE sales_channel_page_id = ? 
         AND order_date BETWEEN ? AND ?";
$stmt2 = $pdo->prepare($sql2);
$stmt2->execute([$pageId, $dateFrom . ' 00:00:00', $dateTo . ' 23:59:59']);
$orders = $stmt2->fetch(PDO::FETCH_ASSOC);

echo "Order Count: {$orders['order_count']}\n";
echo "Total Sales: " . number_format($orders['total_sales'] ?? 0, 2) . "\n";

// 3. Simulate the problematic JOIN
echo "\n=== SIMULATING PROBLEMATIC JOIN ===\n";
$sql3 = "
    SELECT 
        p.id,
        p.name,
        mal.ads_cost,
        o.id as order_id,
        o.total_amount
    FROM pages p
    LEFT JOIN marketing_ads_log mal ON p.id = mal.page_id AND mal.date BETWEEN ? AND ?
    LEFT JOIN orders o ON p.id = o.sales_channel_page_id AND o.order_date BETWEEN ? AND ?
    WHERE p.id = ?
";
$stmt3 = $pdo->prepare($sql3);
$stmt3->execute([$dateFrom, $dateTo, $dateFrom . ' 00:00:00', $dateTo . ' 23:59:59', $pageId]);
$rows = $stmt3->fetchAll(PDO::FETCH_ASSOC);

echo "Rows returned: " . count($rows) . "\n\n";
foreach ($rows as $r) {
    echo "Ads: " . number_format($r['ads_cost'] ?? 0, 2) . " | Order: {$r['order_id']} | Amount: " . number_format($r['total_amount'] ?? 0, 2) . "\n";
}

// 4. Calculate what SUM gives with current query
$sumAds = 0;
foreach ($rows as $r) {
    $sumAds += ($r['ads_cost'] ?? 0);
}
echo "\nSUM(ads_cost) from joined rows: " . number_format($sumAds, 2) . "\n";

// 5. Show the math
echo "\n=== THE PROBLEM ===\n";
echo "Actual ads_cost: " . number_format($actualAdsTotal, 2) . "\n";
echo "Number of orders: {$orders['order_count']}\n";
echo "Multiplied result: " . number_format($actualAdsTotal * $orders['order_count'], 2) . "\n";
echo "Dashboard shows: " . number_format($sumAds, 2) . "\n";

if ($sumAds == $actualAdsTotal * $orders['order_count']) {
    echo "\n⚠️ CONFIRMED: Ads cost is being multiplied by order count!\n";
    echo "This is a CARTESIAN PRODUCT problem from double LEFT JOIN.\n";
}

echo "\n========================================\n";
echo "  END OF DEBUG\n";
echo "========================================\n";
