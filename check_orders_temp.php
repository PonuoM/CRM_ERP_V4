<?php
require_once __DIR__ . '/api/config.php';
$pdo = db_connect();

// Customer ID from the image
$customerId = 189691;

echo "Customer $customerId info:\n";
$stmt = $pdo->prepare("SELECT customer_id, first_name, assigned_to, current_basket_key FROM customers WHERE customer_id = ?");
$stmt->execute([$customerId]);
print_r($stmt->fetch(PDO::FETCH_ASSOC));

echo "\n\nLatest orders for customer $customerId:\n";
$stmt = $pdo->prepare("
    SELECT o.id, o.order_date, o.order_status, o.creator_id, u.role_id, u.first_name as creator_name
    FROM orders o
    LEFT JOIN users u ON o.creator_id = u.id
    WHERE o.customer_id = ?
    ORDER BY o.order_date DESC
    LIMIT 5
");
$stmt->execute([$customerId]);
$orders = $stmt->fetchAll(PDO::FETCH_ASSOC);
foreach ($orders as $o) {
    echo "Order: {$o['id']} | Date: {$o['order_date']} | Status: {$o['order_status']} | Creator: {$o['creator_name']} (ID:{$o['creator_id']}) | Role ID: {$o['role_id']}\n";
}
