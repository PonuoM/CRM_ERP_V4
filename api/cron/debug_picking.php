<?php
ini_set('display_errors', 1);
error_reporting(E_ALL);

require_once __DIR__ . '/../config.php';

header('Content-Type: text/html; charset=utf-8');
echo "<pre>\n";
echo "=== DEBUG: Check Recent Picking Orders ===\n";
echo "Current Time: " . date('Y-m-d H:i:s') . "\n\n";

$pdo = db_connect();

// Show ALL Picking orders from the last 2 hours
$stmt = $pdo->query("
    SELECT 
        o.id as order_id,
        o.customer_id,
        o.creator_id,
        o.order_status,
        o.order_date,
        c.customer_id as customer_pk,
        c.assigned_to,
        c.current_basket_key,
        u.role_id as creator_role_id
    FROM orders o
    INNER JOIN customers c ON (c.customer_ref_id = o.customer_id OR c.customer_id = o.customer_id)
    LEFT JOIN users u ON u.id = o.creator_id
    WHERE o.order_status = 'Picking'
      AND o.order_date >= DATE_SUB(NOW(), INTERVAL 2 HOUR)
    ORDER BY o.order_date DESC
    LIMIT 20
");
$orders = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo "Found " . count($orders) . " Picking orders in last 2 hours:\n\n";

foreach ($orders as $order) {
    $creatorRoleId = (int)($order['creator_role_id'] ?? 0);
    $assignedTo = (int)($order['assigned_to'] ?? 0);
    $creatorId = (int)($order['creator_id'] ?? 0);
    $basketKey = (int)($order['current_basket_key'] ?? 0);
    
    $isTelesale = ($creatorRoleId === 6 || $creatorRoleId === 7);
    $isOwner = ($assignedTo > 0 && $assignedTo === $creatorId);
    $alreadyInBasket39 = ($basketKey === 39);
    
    echo "Order: {$order['order_id']}\n";
    echo "  - Order Date: {$order['order_date']}\n";
    echo "  - Customer: {$order['customer_pk']}\n";
    echo "  - Creator: {$creatorId} (role: {$creatorRoleId})\n";
    echo "  - Assigned To: {$assignedTo}\n";
    echo "  - Current Basket: {$basketKey}\n";
    echo "  - Is Telesale/Supervisor: " . ($isTelesale ? 'YES' : 'NO') . "\n";
    echo "  - Is Owner: " . ($isOwner ? 'YES' : 'NO') . "\n";
    echo "  - Already in Basket 39: " . ($alreadyInBasket39 ? 'YES (skip)' : 'NO') . "\n";
    
    if ($isTelesale && $isOwner && !$alreadyInBasket39) {
        echo "  ==> SHOULD BE MOVED TO BASKET 39!\n";
    } elseif ($alreadyInBasket39) {
        echo "  ==> Already processed\n";
    } else {
        echo "  ==> Does not meet criteria\n";
    }
    echo "\n";
}

echo "</pre>";
