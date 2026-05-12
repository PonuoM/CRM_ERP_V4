<?php
header('Content-Type: text/plain; charset=utf-8');
$conn = new mysqli('202.183.192.218', 'primacom_bloguser', 'pJnL53Wkhju2LaGPytw8', 'primacom_mini_erp');
$conn->set_charset("utf8mb4");

// 1. Find Biochemical products
$res = $conn->query("SELECT id FROM products WHERE name LIKE '%ชีว%' OR category LIKE '%ชีว%' OR report_category LIKE '%ชีว%'");
$bio_product_ids = [];
if ($res) {
    while($r = $res->fetch_assoc()){
        $bio_product_ids[] = $r['id'];
    }
}
if (empty($bio_product_ids)) {
    $bio_product_ids = [0]; // fallback
}
$in_bio = implode(',', $bio_product_ids);

// 2. Report Query
$sql = "
SELECT 
    u.id AS user_id,
    CONCAT(u.first_name, ' ', u.last_name) AS user_name,
    u.status,
    COUNT(DISTINCT o.id) AS total_orders,
    SUM(COALESCE(oi.net_total, oi.quantity * oi.price_per_unit)) AS total_sales,
    SUM(CASE WHEN oi.product_id IN ($in_bio) THEN COALESCE(oi.net_total, oi.quantity * oi.price_per_unit) ELSE 0 END) AS bio_sales
FROM users u
LEFT JOIN orders o ON o.creator_id = u.id 
    AND o.order_date >= '2026-03-16 13:00:00' 
    AND o.order_date <= '2026-03-16 23:59:59'
    AND o.order_status != 'Cancelled'
LEFT JOIN order_items oi ON oi.parent_order_id = o.id 
    AND oi.is_freebie = 0
WHERE u.role_id IN (6, 7) AND u.company_id = 1
GROUP BY u.id, CONCAT(u.first_name, ' ', u.last_name), u.status
HAVING u.status = 'active' OR total_sales > 0
ORDER BY total_sales DESC
";

$res = $conn->query($sql);
if ($res) {
    printf("%-35s | %-10s | %-10s | %-15s | %-15s\n", "Telesale Name", "Status", "Orders", "Total Sales", "Bio Sales");
    echo str_repeat("-", 95) . "\n";
    
    $sum_orders = 0;
    $sum_total = 0;
    $sum_bio = 0;
    
    while($r = $res->fetch_assoc()){
        printf("%-35s | %-10s | %-10s | %-15.2f | %-15.2f\n", 
            mb_substr($r['user_name'], 0, 35), 
            $r['status'],
            $r['total_orders'], 
            $r['total_sales'], 
            $r['bio_sales']
        );
        $sum_orders += $r['total_orders'];
        $sum_total += $r['total_sales'];
        $sum_bio += $r['bio_sales'];
    }
    echo str_repeat("-", 95) . "\n";
    printf("%-35s | %-10s | %-10s | %-15.2f | %-15.2f\n", "TOTAL", "", $sum_orders, $sum_total, $sum_bio);
    
} else {
    echo "Query error: " . $conn->error . "\n";
}

$conn->close();
?>
