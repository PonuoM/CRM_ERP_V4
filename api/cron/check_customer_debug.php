<?php
// STANDALONE DEBUG SCRIPT - Put in api/cron/ folder
// URL: https://www.prima49.com/beta_test/api/cron/check_customer_debug.php?cid=189691
// DELETE THIS FILE AFTER USE!

require_once __DIR__ . '/../config.php';

header('Content-Type: text/plain; charset=utf-8');

$pdo = db_connect();

$customerId = $_GET['cid'] ?? 189691;

echo "=== Customer Debug for ID: $customerId ===\n\n";

echo "Customer info:\n";
$stmt = $pdo->prepare("SELECT customer_id, first_name, last_name, assigned_to, current_basket_key FROM customers WHERE customer_id = ?");
$stmt->execute([$customerId]);
$cust = $stmt->fetch(PDO::FETCH_ASSOC);
if ($cust) {
    echo "ID: {$cust['customer_id']}\n";
    echo "Name: {$cust['first_name']} {$cust['last_name']}\n";
    echo "Assigned To: {$cust['assigned_to']}\n";
    echo "Current Basket: {$cust['current_basket_key']}\n";
} else {
    echo "Customer not found!\n";
}

echo "\n\nLatest orders:\n";
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
if (empty($orders)) {
    echo "No orders found!\n";
} else {
    foreach ($orders as $o) {
        echo "Order: {$o['id']}\n";
        echo "  Date: {$o['order_date']}\n";
        echo "  Status: {$o['order_status']}\n";
        echo "  Creator: {$o['creator_name']} (ID:{$o['creator_id']})\n";
        echo "  Creator Role ID: {$o['role_id']}\n";
        echo "---\n";
    }
}
