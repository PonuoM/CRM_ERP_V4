<?php
require 'api/config.php';
$pdo = db_connect();

$orderId = '251226-00023adminga';

echo "🔍 Testing NEW Commission Logic for Order: {$orderId}\n";
echo "========================================================\n\n";

// Get order info
$stmt = $pdo->prepare("
    SELECT o.id, o.creator_id as order_creator_id, srl.confirmed_amount
    FROM orders o
    JOIN statement_reconcile_logs srl ON srl.order_id = o.id
    WHERE o.id = ?
");
$stmt->execute([$orderId]);
$order = $stmt->fetch();

$order_creator_id = $order['order_creator_id'];

echo "📦 Order Info:\n";
echo "  Order Creator: {$order_creator_id}\n";
echo "  Confirmed Amount: {$order['confirmed_amount']}\n\n";

// Get items
$stmt = $pdo->prepare("
    SELECT 
        id, 
        product_name,
        creator_id, 
        net_total, 
        is_freebie, 
        parent_item_id 
    FROM order_items 
    WHERE parent_order_id = ?
");
$stmt->execute([$orderId]);
$items = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Calculate total value
$total_item_value = 0;
foreach ($items as $item) {
    $total_item_value += (float)$item['net_total'];
}

$ratio = $total_item_value > 0 ? $order['confirmed_amount'] / $total_item_value : 0;

echo "  Total Item Value: {$total_item_value}\n";
echo "  Payment Ratio: {$ratio}\n\n";

// Process each item with NEW LOGIC
$salesData = [];
foreach ($items as $item) {
    // Exclusion Logic (NEW)
    if ((int)$item['is_freebie'] === 1) {
        echo "  Item #{$item['id']}: {$item['product_name']}\n";
        echo "    ❌ SKIP: Freebie\n\n";
        continue;
    }
    
    // Determine beneficiary first
    $item_creator_id = !empty($item['creator_id']) ? $item['creator_id'] : null;
    $beneficiary_id = $item_creator_id ?? $order_creator_id;
    
    // NEW LOGIC: Skip promotion children ONLY if same creator
    if (!empty($item['parent_item_id'])) {
        if ($item_creator_id && $item_creator_id != $order_creator_id) {
            // This is an upsell item, DON'T skip it
            echo "  Item #{$item['id']}: {$item['product_name']}\n";
            echo "    Creator: {$item_creator_id} (UPSELL - different from order creator {$order_creator_id})\n";
            echo "    ✅ UPSELL ITEM - Will be included!\n";
        } else {
            // Same creator, skip
            echo "  Item #{$item['id']}: {$item['product_name']}\n";
            echo "    ❌ SKIP: Promotion child (same creator)\n\n";
            continue;
        }
    } else {
        echo "  Item #{$item['id']}: {$item['product_name']}\n";
        echo "    Creator: " . ($item_creator_id ?? 'NULL (using order creator)') . "\n";
    }
    
    $item_net = (float)$item['net_total'];
    $commissionable_amount = $item_net * $ratio;
    
    echo "    Net Total: {$item_net}\n";
    echo "    Commissionable: {$commissionable_amount}\n";
    
    if ($commissionable_amount <= 0) {
        echo "    ❌ SKIP: Amount <= 0\n\n";
        continue;
    }
    
    echo "    ✅ COMMISSIONABLE\n\n";
    
    // Add to sales data
    if (!isset($salesData[$beneficiary_id])) {
        $salesData[$beneficiary_id] = [
            'total_sales' => 0,
            'order_count' => 0,
            'orders_seen' => []
        ];
    }
    
    $salesData[$beneficiary_id]['total_sales'] += $commissionable_amount;
    
    if (!isset($salesData[$beneficiary_id]['orders_seen'][$orderId])) {
        $salesData[$beneficiary_id]['order_count']++;
        $salesData[$beneficiary_id]['orders_seen'][$orderId] = true;
    }
}

echo "📊 Sales Data Summary:\n";
foreach ($salesData as $userId => $data) {
    $commission = $data['total_sales'] * 0.05;
    echo "  User #{$userId}:\n";
    echo "    Total Sales: {$data['total_sales']}\n";
    echo "    Commission (5%): {$commission}\n";
    echo "    Orders: {$data['order_count']}\n\n";
}

if (isset($salesData[1655])) {
    echo "✅ SUCCESS! User 1655 IS in sales data now!\n";
} else {
    echo "❌ User 1655 still NOT in sales data\n";
}
