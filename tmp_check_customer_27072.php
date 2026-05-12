<?php
header('Content-Type: text/plain; charset=utf-8');
$conn = new mysqli('202.183.192.218', 'primacom_bloguser', 'pJnL53Wkhju2LaGPytw8', 'primacom_mini_erp');
$conn->set_charset("utf8mb4");

$cid = 27072;

// 1) ดูข้อมูลลูกค้า
echo "=== 1) Customer info (id=$cid) ===\n";
$res = $conn->query("
    SELECT c.customer_id, CONCAT(c.first_name,' ',c.last_name) AS name, c.phone,
           c.company_id, c.assigned_to, c.grade, c.lifecycle_status,
           c.order_count, c.total_purchases, c.last_order_date,
           u.role_id, u.company_id AS user_company,
           CONCAT(u.first_name,' ',u.last_name) AS assigned_user
    FROM customers c
    LEFT JOIN users u ON u.id = c.assigned_to
    WHERE c.customer_id = $cid
");
$cust = $res->fetch_assoc();
if (!$cust) { echo "ไม่พบลูกค้า\n"; exit; }
print_r($cust);

// 2) ดู orders ทั้งหมดของลูกค้านี้ในปี 2026
echo "\n=== 2) Orders ของลูกค้านี้ในปี 2026 ===\n";
$res = $conn->query("
    SELECT o.id, o.order_date, o.order_status, o.creator_id,
           CONCAT(uc.first_name,' ',uc.last_name) AS order_creator,
           uc.role_id AS creator_role, uc.company_id AS creator_company
    FROM orders o
    LEFT JOIN users uc ON uc.id = o.creator_id
    WHERE o.customer_id = $cid
      AND o.order_date >= '2026-01-01'
      AND o.order_date <  '2027-01-01'
    ORDER BY o.order_date
");
$order_count = 0;
while ($r = $res->fetch_assoc()) {
    $order_count++;
    echo "  - order #{$r['id']} | {$r['order_date']} | status={$r['order_status']} | creator={$r['order_creator']} (id={$r['creator_id']}, role={$r['creator_role']}, company={$r['creator_company']})\n";
}
echo "รวม orders ปี 2026: $order_count\n";

// 3) ดู order_items breakdown
echo "\n=== 3) Order Items ของลูกค้านี้ในปี 2026 (ทุก order, รวม cancelled/freebie) ===\n";
$res = $conn->query("
    SELECT o.id AS order_id, o.order_date, o.order_status,
           oi.creator_id AS item_creator_id,
           CONCAT(ui.first_name,' ',ui.last_name) AS item_creator_name,
           ui.role_id AS item_creator_role,
           ui.company_id AS item_creator_company,
           oi.product_name, oi.quantity, oi.price_per_unit, oi.net_total, oi.is_freebie
    FROM orders o
    JOIN order_items oi ON oi.parent_order_id = o.id
    LEFT JOIN users ui ON ui.id = oi.creator_id
    WHERE o.customer_id = $cid
      AND o.order_date >= '2026-01-01'
      AND o.order_date <  '2027-01-01'
    ORDER BY o.order_date, oi.id
");
while ($r = $res->fetch_assoc()) {
    echo sprintf("  order#%-6s %s status=%-10s | item_creator=%s (id=%s, role=%s, comp=%s) | %s qty=%s net=%s freebie=%s\n",
        $r['order_id'], substr($r['order_date'],0,10), $r['order_status'],
        $r['item_creator_name'], $r['item_creator_id'], $r['item_creator_role'], $r['item_creator_company'],
        mb_substr($r['product_name'] ?? '', 0, 25),
        $r['quantity'], $r['net_total'], $r['is_freebie']
    );
}

// 4) ทำไมไม่ติดในรายงาน — เช็คตามเงื่อนไขทีละข้อ
echo "\n=== 4) Diagnostic: ลูกค้านี้ทำไมไม่ติดรายงาน ===\n";

$assigned_to = $cust['assigned_to'];
$user_role = $cust['role_id'];
$user_company = $cust['user_company'];

if (!$assigned_to) {
    echo "❌ ลูกค้าไม่มี assigned_to (ไม่มี telesale ดูแล)\n";
} else {
    echo "✓ assigned_to = $assigned_to ({$cust['assigned_user']})\n";
    if (!in_array($user_role, [6,7])) echo "❌ Telesale ปัจจุบันไม่ใช่ role 6/7 (role={$user_role})\n";
    else echo "✓ role = $user_role (telesale)\n";
    if ($user_company != 1) echo "❌ Telesale ปัจจุบันไม่ใช่ company 1 (company={$user_company})\n";
    else echo "✓ company = 1\n";
}

// นับ orders ที่จะติดเงื่อนไขรายงาน (item_creator = assigned_to ปัจจุบัน)
$res = $conn->query("
    SELECT COUNT(DISTINCT o.id) AS cnt
    FROM orders o
    JOIN order_items oi ON oi.parent_order_id = o.id AND oi.creator_id = {$assigned_to}
    WHERE o.customer_id = $cid
      AND o.order_date >= '2026-01-01' AND o.order_date < '2027-01-01'
      AND o.order_status != 'Cancelled'
      AND oi.is_freebie = 0
");
$cnt = (int)$res->fetch_assoc()['cnt'];
echo "จำนวน orders ปี 2026 ที่ item_creator = telesale ปัจจุบัน (ตัด Cancel/Freebie): $cnt\n";
if ($cnt < 3) echo "❌ ไม่ถึง 3 ครั้ง — ตกเงื่อนไข HAVING >= 3\n";
else echo "✓ ถึงเกณฑ์ >= 3 ครั้งแล้ว — ควรต้องติดในรายงาน\n";

// 5) ลองเทียบ: ถ้าใช้ orders.creator_id แทน order_items.creator_id ได้กี่ครั้ง
echo "\n=== 5) เทียบ: ถ้านับด้วย orders.creator_id (ไม่ใช่ item creator) ===\n";
$res = $conn->query("
    SELECT COUNT(DISTINCT o.id) AS cnt
    FROM orders o
    WHERE o.customer_id = $cid
      AND o.creator_id = {$assigned_to}
      AND o.order_date >= '2026-01-01' AND o.order_date < '2027-01-01'
      AND o.order_status != 'Cancelled'
");
$cnt2 = (int)$res->fetch_assoc()['cnt'];
echo "orders.creator_id = telesale: $cnt2 ครั้ง\n";

$conn->close();
