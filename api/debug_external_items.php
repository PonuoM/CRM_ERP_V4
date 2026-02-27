<?php
/**
 * Quick debug: Check order_items for EXTERNAL orders
 */
require_once __DIR__ . '/config.php';
header('Content-Type: text/html; charset=utf-8');

$pdo = db_connect();

$orderId = $_GET['id'] ?? '20260102-000161EXTERNAL';

echo "<html><head><meta charset='utf-8'><title>Debug EXTERNAL Items</title>";
echo "<style>body{font-family:monospace;padding:20px;background:#1a1a2e;color:#eee}table{border-collapse:collapse;margin:10px 0}th{background:#0f3460;color:#fff;padding:6px 10px}td{border:1px solid #333;padding:4px 8px}</style></head><body>";

// 1. Order header
echo "<h2>Order: $orderId</h2>";
$stmt = $pdo->prepare("SELECT id, order_date, creator_id, total_amount, order_status, payment_method FROM orders WHERE id = ?");
$stmt->execute([$orderId]);
$order = $stmt->fetch(PDO::FETCH_ASSOC);
if ($order) {
    echo "<table><tr><th>Field</th><th>Value</th></tr>";
    foreach ($order as $k => $v) {
        echo "<tr><td>$k</td><td>$v</td></tr>";
    }
    echo "</table>";
} else {
    echo "<p style='color:red'>Order not found!</p>";
}

// 2. Order items
echo "<h2>Order Items</h2>";
$stmt = $pdo->prepare("SELECT id, product_id, product_name, quantity, price_per_unit, discount, net_total, is_freebie, box_number, creator_id, basket_key_at_sale FROM order_items WHERE order_id = ? OR parent_order_id = ?");
$stmt->execute([$orderId, $orderId]);
$items = $stmt->fetchAll(PDO::FETCH_ASSOC);

if (count($items) > 0) {
    echo "<p style='color:lime'>Found " . count($items) . " items</p>";
    echo "<table><tr>";
    foreach (array_keys($items[0]) as $col) {
        echo "<th>$col</th>";
    }
    echo "</tr>";
    foreach ($items as $item) {
        echo "<tr>";
        foreach ($item as $v) {
            echo "<td>" . htmlspecialchars($v ?? 'NULL') . "</td>";
        }
        echo "</tr>";
    }
    echo "</table>";
} else {
    echo "<p style='color:red'>NO ITEMS FOUND for this order!</p>";
}

// 3. Also check a few more EXTERNAL orders
echo "<h2>Sample EXTERNAL Orders (Jan 2026) — Items Count</h2>";
$stmt = $pdo->query("
    SELECT o.id, o.total_amount, o.order_status,
           COUNT(oi.id) as item_count,
           SUM(oi.price_per_unit * oi.quantity) as items_total
    FROM orders o
    LEFT JOIN order_items oi ON oi.order_id = o.id
    WHERE o.creator_id = 33 
      AND o.id LIKE '%EXTERNAL%'
      AND o.order_date >= '2026-01-01' AND o.order_date < '2026-02-01'
    GROUP BY o.id
    ORDER BY o.order_date
");
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
echo "<table><tr><th>Order ID</th><th>total_amount</th><th>status</th><th>item_count</th><th>items_total</th></tr>";
foreach ($rows as $r) {
    $mismatch = (abs(($r['total_amount'] ?? 0) - ($r['items_total'] ?? 0)) > 1) ? 'style="color:orange"' : '';
    echo "<tr $mismatch><td>{$r['id']}</td><td>{$r['total_amount']}</td><td>{$r['order_status']}</td><td>{$r['item_count']}</td><td>{$r['items_total']}</td></tr>";
}
echo "</table>";
echo "</body></html>";
