<?php
header('Content-Type: text/plain; charset=utf-8');
$conn = new mysqli('202.183.192.218', 'primacom_bloguser', 'pJnL53Wkhju2LaGPytw8', 'primacom_mini_erp');
$conn->set_charset("utf8mb4");

$cid = 27072;

echo "=== Orders ของ customer $cid ทุกปี ===\n";
$res = $conn->query("
    SELECT YEAR(o.order_date) AS yr,
           COUNT(DISTINCT o.id) AS order_cnt,
           SUM(CASE WHEN o.order_status='Cancelled' THEN 1 ELSE 0 END) AS cancelled_cnt,
           MIN(o.order_date) AS first_order,
           MAX(o.order_date) AS last_order
    FROM orders o
    WHERE o.customer_id = $cid
    GROUP BY YEAR(o.order_date)
    ORDER BY yr
");
while ($r = $res->fetch_assoc()) {
    echo "  ปี {$r['yr']}: {$r['order_cnt']} ออเดอร์ (cancelled={$r['cancelled_cnt']}) | {$r['first_order']} ถึง {$r['last_order']}\n";
}

echo "\n=== Detail orders ทุกปี (รวม cancelled) ===\n";
$res = $conn->query("
    SELECT o.id, o.order_date, o.order_status, o.creator_id,
           CONCAT(uc.first_name,' ',uc.last_name) AS creator_name
    FROM orders o
    LEFT JOIN users uc ON uc.id = o.creator_id
    WHERE o.customer_id = $cid
    ORDER BY o.order_date
");
while ($r = $res->fetch_assoc()) {
    echo "  - #{$r['id']} | {$r['order_date']} | status={$r['order_status']} | creator={$r['creator_name']}\n";
}

echo "\n=== ถ้านับรวมทั้งชีวิต (เฉพาะ item_creator = telesale ปัจจุบัน id=24, ตัด Cancel/Freebie) ===\n";
$res = $conn->query("
    SELECT COUNT(DISTINCT o.id) AS cnt
    FROM orders o
    JOIN order_items oi ON oi.parent_order_id = o.id AND oi.creator_id = 24
    WHERE o.customer_id = $cid
      AND o.order_status != 'Cancelled'
      AND oi.is_freebie = 0
");
echo "รวมตลอดเวลา: " . $res->fetch_assoc()['cnt'] . " ออเดอร์\n";

$conn->close();
