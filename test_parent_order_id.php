<?php
require 'api/config.php';
$pdo = db_connect();

$orderId = '251226-00023adminga';

echo "🔍 Testing parent_order_id Query\n";
echo "=================================\n\n";

// Old query (order_id)
$stmt = $pdo->prepare("
    SELECT COUNT(*) as count
    FROM order_items 
    WHERE order_id = ?
");
$stmt->execute([$orderId]);
$oldCount = $stmt->fetch()['count'];

// New query (parent_order_id)
$stmt = $pdo->prepare("
    SELECT COUNT(*) as count
    FROM order_items 
    WHERE parent_order_id = ?
");
$stmt->execute([$orderId]);
$newCount = $stmt->fetch()['count'];

echo "Order ID: {$orderId}\n\n";
echo "Results:\n";
echo "  Old Query (order_id):        {$oldCount} items\n";
echo "  New Query (parent_order_id): {$newCount} items\n\n";

if ($newCount > 0) {
    echo "✅ SUCCESS! Found items using parent_order_id\n\n";
    
    // Show items
    $stmt = $pdo->prepare("
        SELECT id, product_name, quantity, net_total, is_freebie, parent_item_id, creator_id
        FROM order_items 
        WHERE parent_order_id = ?
    ");
    $stmt->execute([$orderId]);
    $items = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "Items:\n";
    foreach ($items as $item) {
        echo "  - {$item['product_name']}: {$item['quantity']} x {$item['net_total']}\n";
        echo "    Creator: " . ($item['creator_id'] ?? 'NULL') . "\n";
        echo "    Freebie: {$item['is_freebie']}, Parent Item: " . ($item['parent_item_id'] ?? 'NULL') . "\n";
    }
} else {
    echo "❌ Still no items found!\n";
}
