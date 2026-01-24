<?php
require_once __DIR__ . '/config.php';

$pdo = db_connect();

echo "=== Checking customer order data ===\n\n";

// Check customers table
$stmt = $pdo->query("
    SELECT c.customer_id, c.first_name, c.last_name, c.last_order_date, c.order_count 
    FROM customers c 
    WHERE c.company_id = 1
    LIMIT 10
");
echo "Customers table (last_order_date, order_count):\n";
while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    echo "  {$row['first_name']} {$row['last_name']}: order_date={$row['last_order_date']}, count={$row['order_count']}\n";
}

echo "\n=== Checking orders table ===\n";
$stmt = $pdo->query("SELECT COUNT(*) as cnt FROM orders WHERE company_id = 1");
$orderCount = $stmt->fetchColumn();
echo "Total orders: $orderCount\n";

// Check orders with customers
$stmt = $pdo->query("
    SELECT o.customer_id, c.first_name, c.last_name, o.order_date, o.total_amount
    FROM orders o
    JOIN customers c ON o.customer_id = c.customer_id
    WHERE o.company_id = 1
    LIMIT 10
");
echo "\nOrders with customers:\n";
while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    echo "  {$row['first_name']} {$row['last_name']}: {$row['order_date']} - ฿{$row['total_amount']}\n";
}
