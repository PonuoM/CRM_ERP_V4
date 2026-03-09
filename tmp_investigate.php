<?php
$conn = new mysqli('202.183.192.218', 'primacom_bloguser', 'pJnL53Wkhju2LaGPytw8', 'primacom_mini_erp');
$conn->set_charset("utf8mb4");

function q($conn, $sql) {
    $r = $conn->query($sql);
    if (!$r) { echo "ERR: " . $conn->error . "\n"; return []; }
    $rows = [];
    while($row = $r->fetch_assoc()) $rows[] = $row;
    return $rows;
}

// Products full details for company 1
echo "PRODUCTS_CO1\n";
foreach(q($conn, "SELECT id, name, category, report_category, company_id FROM products WHERE company_id=1 ORDER BY id") as $r) {
    echo "pid={$r['id']}|{$r['name']}|cat={$r['category']}|rcat={$r['report_category']}|co={$r['company_id']}\n";
}

echo "\nPRODUCTS_CO2\n";
foreach(q($conn, "SELECT id, name, category, report_category, company_id FROM products WHERE company_id=2 ORDER BY id") as $r) {
    echo "pid={$r['id']}|{$r['name']}|cat={$r['category']}|rcat={$r['report_category']}|co={$r['company_id']}\n";
}

// Check the January ปุ๋ยเม็ด spike - what products are those 44K qty?
echo "\nJAN_PUIMET_DETAIL\n";
foreach(q($conn, "
    SELECT oi.product_name, SUM(oi.quantity) as qty, SUM(COALESCE(oi.net_total, oi.quantity*oi.price_per_unit)) as rev
    FROM orders o JOIN order_items oi ON oi.parent_order_id=o.id
    WHERE o.company_id=1 AND DATE_FORMAT(o.order_date,'%Y-%m')='2025-01'
      AND (oi.product_name LIKE 'สิงห์%' OR oi.product_name LIKE 'สารปรับปรุง%')
    GROUP BY oi.product_name ORDER BY qty DESC
") as $r) {
    echo "{$r['product_name']}|qty={$r['qty']}|rev={$r['rev']}\n";
}

// For comparison - Feb puimet
echo "\nFEB_PUIMET_DETAIL\n";
foreach(q($conn, "
    SELECT oi.product_name, SUM(oi.quantity) as qty, SUM(COALESCE(oi.net_total, oi.quantity*oi.price_per_unit)) as rev
    FROM orders o JOIN order_items oi ON oi.parent_order_id=o.id
    WHERE o.company_id=1 AND DATE_FORMAT(o.order_date,'%Y-%m')='2025-02'
      AND (oi.product_name LIKE 'สิงห์%' OR oi.product_name LIKE 'สารปรับปรุง%')
    GROUP BY oi.product_name ORDER BY qty DESC
") as $r) {
    echo "{$r['product_name']}|qty={$r['qty']}|rev={$r['rev']}\n";
}

// GRAND TOTALS separated by product type
echo "\nGRAND_TOTALS\n";
echo "=== ต่าย (ปุ๋ยน้ำ/ชีวภัณฑ์) ===\n";
foreach(q($conn, "
    SELECT 
        oi.product_name, 
        SUM(oi.quantity) as qty, 
        SUM(COALESCE(oi.net_total, oi.quantity*oi.price_per_unit)) as rev,
        COUNT(DISTINCT o.id) as order_cnt
    FROM orders o JOIN order_items oi ON oi.parent_order_id=o.id
    WHERE o.company_id=1 AND o.order_date>='2025-01-01' AND o.order_date<'2026-01-01'
      AND oi.product_name NOT LIKE 'สิงห์%' AND oi.product_name NOT LIKE 'สารปรับปรุง%'
      AND oi.product_name NOT LIKE 'เสื้อ%' AND oi.product_name != 'ไม่ระบุสินค้า'
    GROUP BY oi.product_name ORDER BY rev DESC
") as $r) {
    echo "{$r['product_name']}|qty={$r['qty']}|orders={$r['order_cnt']}|rev=" . number_format($r['rev'],2) . "\n";
}

echo "\n=== ต่ายเล็ก (ปุ๋ยเม็ด) ===\n";
foreach(q($conn, "
    SELECT 
        oi.product_name, 
        SUM(oi.quantity) as qty, 
        SUM(COALESCE(oi.net_total, oi.quantity*oi.price_per_unit)) as rev,
        COUNT(DISTINCT o.id) as order_cnt
    FROM orders o JOIN order_items oi ON oi.parent_order_id=o.id
    WHERE o.company_id=1 AND o.order_date>='2025-01-01' AND o.order_date<'2026-01-01'
      AND (oi.product_name LIKE 'สิงห์%' OR oi.product_name LIKE 'สารปรับปรุง%')
    GROUP BY oi.product_name ORDER BY rev DESC
") as $r) {
    echo "{$r['product_name']}|qty={$r['qty']}|orders={$r['order_cnt']}|rev=" . number_format($r['rev'],2) . "\n";
}

// Summary totals
echo "\nSUMMARY\n";
foreach(q($conn, "
    SELECT 
        'ปุ๋ยน้ำ' as group_name,
        COUNT(DISTINCT o.id) as orders,
        SUM(oi.quantity) as qty,
        SUM(COALESCE(oi.net_total, oi.quantity*oi.price_per_unit)) as rev
    FROM orders o JOIN order_items oi ON oi.parent_order_id=o.id
    WHERE o.company_id=1 AND o.order_date>='2025-01-01' AND o.order_date<'2026-01-01'
      AND oi.product_name NOT LIKE 'สิงห์%' AND oi.product_name NOT LIKE 'สารปรับปรุง%'
      AND oi.product_name NOT LIKE 'เสื้อ%' AND oi.product_name != 'ไม่ระบุสินค้า'
    UNION ALL
    SELECT 
        'ปุ๋ยเม็ด' as group_name,
        COUNT(DISTINCT o.id) as orders,
        SUM(oi.quantity) as qty,
        SUM(COALESCE(oi.net_total, oi.quantity*oi.price_per_unit)) as rev
    FROM orders o JOIN order_items oi ON oi.parent_order_id=o.id
    WHERE o.company_id=1 AND o.order_date>='2025-01-01' AND o.order_date<'2026-01-01'
      AND (oi.product_name LIKE 'สิงห์%' OR oi.product_name LIKE 'สารปรับปรุง%')
") as $r) {
    echo "{$r['group_name']}|orders={$r['orders']}|qty={$r['qty']}|rev=" . number_format($r['rev'],2) . "\n";
}

$conn->close();
