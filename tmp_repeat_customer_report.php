<?php
header('Content-Type: text/plain; charset=utf-8');
$conn = new mysqli('202.183.192.218', 'primacom_bloguser', 'pJnL53Wkhju2LaGPytw8', 'primacom_mini_erp');
$conn->set_charset("utf8mb4");

/*
 * เงื่อนไข:
 *  - Telesale: role_id IN (6,7) AND company_id = 1
 *  - ลูกค้าที่ telesale คนนั้นดูแลอยู่ปัจจุบัน: customers.assigned_to = telesale.id
 *  - เชื่อมการขายผ่าน order_items.creator_id = telesale.id (แม่นกว่า orders.creator_id)
 *  - ปี 2026 (order_date)
 *  - ไม่นับ Cancelled และ ไม่นับ freebie
 *  - เกณฑ์: COUNT(DISTINCT order_id) >= 3
 */

$sql_detail = "
SELECT
    u.id AS telesale_id,
    CONCAT(u.first_name, ' ', u.last_name) AS telesale_name,
    u.status AS telesale_status,
    c.customer_id,
    CONCAT(c.first_name, ' ', c.last_name) AS customer_name,
    c.phone,
    c.grade,
    c.lifecycle_status,
    COUNT(DISTINCT o.id) AS order_count,
    SUM(COALESCE(oi.net_total, oi.quantity * oi.price_per_unit)) AS total_sales,
    MIN(o.order_date) AS first_order_date,
    MAX(o.order_date) AS last_order_date
FROM customers c
JOIN users u ON u.id = c.assigned_to
JOIN orders o ON o.customer_id = c.customer_id
JOIN order_items oi ON oi.parent_order_id = o.id AND oi.creator_id = c.assigned_to
WHERE u.role_id IN (6, 7)
    AND u.company_id = 1
    AND o.order_date >= '2026-01-01 00:00:00'
    AND o.order_date <  '2027-01-01 00:00:00'
    AND o.order_status != 'Cancelled'
    AND oi.is_freebie = 0
GROUP BY u.id, telesale_name, u.status, c.customer_id, customer_name, c.phone, c.grade, c.lifecycle_status
HAVING COUNT(DISTINCT o.id) >= 3
ORDER BY telesale_name, order_count DESC, total_sales DESC
";

$rows = [];
$res = $conn->query($sql_detail);
if (!$res) {
    echo "Query error: " . $conn->error . "\n";
    exit;
}
while ($r = $res->fetch_assoc()) {
    $rows[] = $r;
}

// ====== แบบที่ 1: สรุปต่อ Telesale ======
echo "============================================================================\n";
echo " รายงานที่ 1: สรุปต่อ Telesale (company 1, role 6/7) — ปี 2026\n";
echo " เงื่อนไข: ลูกค้าที่ตัวเองดูแลอยู่ + ซื้อ >= 3 ครั้ง (ผ่าน order_items.creator)\n";
echo "============================================================================\n";
printf("%-30s | %-8s | %-12s | %-10s | %-15s\n",
    "Telesale", "Status", "Qual Cust", "Tot Orders", "Tot Sales (THB)");
echo str_repeat("-", 90) . "\n";

$summary = [];
foreach ($rows as $r) {
    $tid = $r['telesale_id'];
    if (!isset($summary[$tid])) {
        $summary[$tid] = [
            'name' => $r['telesale_name'],
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
    return $b['qualified_customers'] <=> $a['qualified_customers'];
});

$g_cust = 0; $g_orders = 0; $g_sales = 0;
foreach ($summary as $tid => $s) {
    printf("%-30s | %-8s | %-12d | %-10d | %15s\n",
        mb_substr($s['name'], 0, 30),
        $s['status'],
        $s['qualified_customers'],
        $s['total_orders'],
        number_format($s['total_sales'], 2)
    );
    $g_cust += $s['qualified_customers'];
    $g_orders += $s['total_orders'];
    $g_sales += $s['total_sales'];
}
echo str_repeat("-", 90) . "\n";
printf("%-30s | %-8s | %-12d | %-10d | %15s\n",
    "TOTAL", "", $g_cust, $g_orders, number_format($g_sales, 2));

// ====== แบบที่ 2: รายละเอียดลูกค้า ======
echo "\n\n";
echo "============================================================================\n";
echo " รายงานที่ 2: รายละเอียดลูกค้าซื้อซ้ำ >= 3 ครั้ง (จัดกลุ่มตาม Telesale)\n";
echo "============================================================================\n";

$current_telesale = null;
foreach ($rows as $r) {
    if ($current_telesale !== $r['telesale_id']) {
        $current_telesale = $r['telesale_id'];
        echo "\n>>> Telesale: " . $r['telesale_name'] . " (id={$r['telesale_id']}, status={$r['telesale_status']})\n";
        printf("    %-25s | %-13s | %-8s | %-12s | %-6s | %-15s | %-12s\n",
            "Customer", "Phone", "Grade", "Lifecycle", "Orders", "Sales (THB)", "Last Order");
        echo "    " . str_repeat("-", 100) . "\n";
    }
    printf("    %-25s | %-13s | %-8s | %-12s | %-6d | %15s | %-12s\n",
        mb_substr($r['customer_name'], 0, 25),
        $r['phone'],
        $r['grade'] ?? '-',
        mb_substr($r['lifecycle_status'] ?? '-', 0, 12),
        (int)$r['order_count'],
        number_format($r['total_sales'], 2),
        substr($r['last_order_date'], 0, 10)
    );
}

echo "\n\nรวมลูกค้าที่เข้าเงื่อนไขทั้งหมด: $g_cust ราย\n";

$conn->close();
