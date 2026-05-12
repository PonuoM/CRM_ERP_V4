<?php
$conn = new mysqli('202.183.192.218', 'primacom_bloguser', 'pJnL53Wkhju2LaGPytw8', 'primacom_mini_erp');
$conn->set_charset("utf8mb4");

// All-time (ทั้งชีวิตลูกค้า) — ไม่กรองปี
$sql = "
SELECT
    u.id AS telesale_id,
    CONCAT(u.first_name, ' ', u.last_name) AS telesale_name,
    u.status AS telesale_status,
    c.customer_id,
    CONCAT(c.first_name, ' ', c.last_name) AS customer_name,
    c.phone,
    c.grade,
    c.lifecycle_status,
    c.bucket_type,
    bc.basket_name AS basket_name,
    bc.basket_key  AS basket_key,
    COUNT(DISTINCT o.id) AS order_count,
    SUM(COALESCE(oi.net_total, oi.quantity * oi.price_per_unit)) AS total_sales,
    MIN(o.order_date) AS first_order_date,
    MAX(o.order_date) AS last_order_date
FROM customers c
JOIN users u ON u.id = c.assigned_to
LEFT JOIN basket_config bc ON bc.id = c.current_basket_key
JOIN orders o ON o.customer_id = c.customer_id
JOIN order_items oi ON oi.parent_order_id = o.id AND oi.creator_id = c.assigned_to
WHERE u.role_id IN (6, 7)
    AND u.company_id = 1
    AND o.order_status != 'Cancelled'
    AND oi.is_freebie = 0
GROUP BY u.id, telesale_name, u.status, c.customer_id, customer_name, c.phone, c.grade, c.lifecycle_status, c.bucket_type, bc.basket_name, bc.basket_key
HAVING COUNT(DISTINCT o.id) >= 3
ORDER BY telesale_name, order_count DESC, total_sales DESC
";

$rows = [];
$res = $conn->query($sql);
if (!$res) {
    fwrite(STDERR, "Query error: " . $conn->error . "\n");
    exit(1);
}
while ($r = $res->fetch_assoc()) $rows[] = $r;
$conn->close();

// ===== Summary per telesale =====
$summary = [];
foreach ($rows as $r) {
    $tid = $r['telesale_id'];
    if (!isset($summary[$tid])) {
        $summary[$tid] = [
            'telesale_id' => $tid,
            'telesale_name' => $r['telesale_name'],
            'status' => $r['telesale_status'],
            'qualified_customers' => 0,
            'total_orders' => 0,
            'total_sales' => 0,
        ];
    }
    $summary[$tid]['qualified_customers'] += 1;
    $summary[$tid]['total_orders'] += (int)$r['order_count'];
    $summary[$tid]['total_sales'] += (float)$r['total_sales'];
}
uasort($summary, function($a, $b) {
    return $b['qualified_customers'] - $a['qualified_customers'];
});

$out_dir = __DIR__;
$summary_file = $out_dir . '/report_repeat_summary_alltime_v2.csv';
$detail_file  = $out_dir . '/report_repeat_detail_alltime_v2.csv';

// ---- Write Summary CSV ----
$fp = fopen($summary_file, 'w');
fwrite($fp, "\xEF\xBB\xBF"); // UTF-8 BOM for Excel
fputcsv($fp, ['อันดับ', 'Telesale ID', 'ชื่อ Telesale', 'สถานะ', 'จำนวนลูกค้าซื้อซ้ำ ≥3 ครั้ง (ทั้งชีวิต)', 'รวม Orders', 'รวมยอดขาย (บาท)']);
$rank = 0;
$g_cust = 0; $g_orders = 0; $g_sales = 0;
foreach ($summary as $s) {
    $rank++;
    fputcsv($fp, [
        $rank,
        $s['telesale_id'],
        $s['telesale_name'],
        $s['status'],
        $s['qualified_customers'],
        $s['total_orders'],
        number_format($s['total_sales'], 2, '.', ''),
    ]);
    $g_cust += $s['qualified_customers'];
    $g_orders += $s['total_orders'];
    $g_sales += $s['total_sales'];
}
fputcsv($fp, ['', '', 'TOTAL', '', $g_cust, $g_orders, number_format($g_sales, 2, '.', '')]);
fclose($fp);

// ---- Write Detail CSV ----
$fp = fopen($detail_file, 'w');
fwrite($fp, "\xEF\xBB\xBF");
fputcsv($fp, [
    'Telesale ID', 'ชื่อ Telesale', 'Customer ID', 'ชื่อลูกค้า', 'เบอร์โทร',
    'Grade', 'Lifecycle', 'Bucket Type', 'ถัง (Basket)', 'Basket Key',
    'จำนวนครั้งที่ซื้อ', 'ยอดรวม (บาท)',
    'วันที่ซื้อครั้งแรก', 'วันที่ซื้อครั้งล่าสุด'
]);
foreach ($rows as $r) {
    fputcsv($fp, [
        $r['telesale_id'],
        $r['telesale_name'],
        $r['customer_id'],
        $r['customer_name'],
        // Force phone as text to keep leading zeros in Excel
        '="' . $r['phone'] . '"',
        $r['grade'] ?? '',
        $r['lifecycle_status'] ?? '',
        $r['bucket_type'] ?? '',
        $r['basket_name'] ?? '',
        $r['basket_key'] ?? '',
        (int)$r['order_count'],
        number_format((float)$r['total_sales'], 2, '.', ''),
        substr($r['first_order_date'], 0, 10),
        substr($r['last_order_date'], 0, 10),
    ]);
}
fclose($fp);

echo "Summary  -> $summary_file (" . count($summary) . " rows)\n";
echo "Detail   -> $detail_file ("  . count($rows)    . " rows)\n";
echo "Total qualified customers: $g_cust | Total orders: $g_orders | Total sales: " . number_format($g_sales, 2) . " THB\n";
