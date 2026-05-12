<?php
header('Content-Type: text/plain; charset=utf-8');
$conn = new mysqli('202.183.192.218', 'primacom_bloguser', 'pJnL53Wkhju2LaGPytw8', 'primacom_mini_erp');
$conn->set_charset("utf8mb4");

$sql = "
SELECT 
    o.id AS order_id,
    o.order_date,
    o.order_status,
    o.total_amount,
    oi.product_id,
    p.name AS product_name,
    oi.quantity,
    oi.price_per_unit,
    oi.net_total,
    oi.is_freebie
FROM users u
JOIN orders o ON o.creator_id = u.id
JOIN order_items oi ON oi.parent_order_id = o.id
LEFT JOIN products p ON p.id = oi.product_id
WHERE u.first_name LIKE '%หน่อย%'
    AND u.role_id IN (6, 7) 
    AND u.company_id = 1
    AND o.order_date >= '2026-03-16 13:00:00' 
    AND o.order_date <= '2026-03-16 23:59:59'
    AND o.order_status != 'Cancelled'
ORDER BY o.id
";

$res = $conn->query($sql);
if ($res) {
    while($r = $res->fetch_assoc()){
        print_r($r);
    }
} else {
    echo "Query error: " . $conn->error . "\n";
}

$conn->close();
?>
