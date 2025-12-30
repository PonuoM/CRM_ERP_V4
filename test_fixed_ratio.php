<?php
require 'api/config.php';
$pdo = db_connect();

$orderId = '251226-00023adminga';

echo "🔍 Testing FIXED Payment Ratio Calculation\n";
echo "===========================================\n\n";

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
$confirmed_amount = $order['confirmed_amount'];

echo "📦 Order Info:\n";
echo "  Order Creator: {$order_creator_id}\n";
echo "  Confirmed Amount: {$confirmed_amount}\n\n";

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

echo "📊 Calculating Total Item Value (NEW LOGIC):\n";

// Calculate total value (NEW LOGIC - exclude promotion children and freebies)
$total_item_value = 0;
foreach ($items as $item) {
    $item_net = (float)$item['net_total'];
    $include = true;
    $reason = '';
    
    // Skip freebies
    if ((int)$item['is_freebie'] === 1) {
        $include = false;
        $reason = 'Freebie';
    }
    // Skip promotion children from same creator
    elseif (!empty($item['parent_item_id'])) {
        $item_creator_id = !empty($item['creator_id']) ? $item['creator_id'] : null;
        if (!$item_creator_id || $item_creator_id == $order_creator_id) {
            $include = false;
            $reason = 'Promotion child (same creator)';
        } else {
            $reason = 'Upsell item (different creator) - INCLUDED';
        }
    }
    
    if ($include) {
        $total_item_value += $item_net;
        echo "  ✅ {$item['product_name']}: {$item_net} ({$reason})\n";
    } else {
        echo "  ❌ {$item['product_name']}: {$item_net} (SKIP: {$reason})\n";
    }
}

echo "\n";
echo "📊 Summary:\n";
echo "  Total Item Value: {$total_item_value}\n";
echo "  Confirmed Amount: {$confirmed_amount}\n";

$ratio = $total_item_value > 0 ? $confirmed_amount / $total_item_value : 0;
echo "  Payment Ratio: {$ratio}\n\n";

// Calculate commissions
echo "💰 Commission Calculation:\n";

$salesData = [];

foreach ($items as $item) {
    // Skip freebies
    if ((int)$item['is_freebie'] === 1) continue;
    
    // Determine beneficiary
    $item_creator_id = !empty($item['creator_id']) ? $item['creator_id'] : null;
    $beneficiary_id = $item_creator_id ?? $order_creator_id;
    
    // Skip promotion children from same creator
    if (!empty($item['parent_item_id'])) {
        if ($item_creator_id && $item_creator_id != $order_creator_id) {
            // Upsell - include
        } else {
            continue;
        }
    }
    
    $item_net = (float)$item['net_total'];
    $commissionable_amount = $item_net * $ratio;
    
    if ($commissionable_amount <= 0) continue;
    
    if (!isset($salesData[$beneficiary_id])) {
        $salesData[$beneficiary_id] = ['total_sales' => 0];
    }
    
    $salesData[$beneficiary_id]['total_sales'] += $commissionable_amount;
    
    echo "  User #{$beneficiary_id}: +{$commissionable_amount} (from {$item['product_name']})\n";
}

echo "\n📊 Final Results:\n";
foreach ($salesData as $userId => $data) {
    $commission = $data['total_sales'] * 0.05;
    echo "  User #{$userId}:\n";
    echo "    Total Sales: {$data['total_sales']}\n";
    echo "    Commission (5%): {$commission}\n\n";
}

// Check if User 1 gets 3000
if (isset($salesData[1]) && abs($salesData[1]['total_sales'] - 3000) < 0.01) {
    echo "✅ SUCCESS! User 1 gets commission from 3,000 baht\n";
} else {
    $user1Sales = $salesData[1]['total_sales'] ?? 0;
    echo "❌ User 1 gets {$user1Sales} instead of 3,000\n";
}
