<?php
require 'api/config.php';
$pdo = db_connect();

$orderId = '251226-00023adminga';

echo "🔍 Debugging Commission Calculation for Order: {$orderId}\n";
echo "==========================================================\n\n";

// Get order info
$stmt = $pdo->prepare("
    SELECT o.id, o.creator_id, srl.confirmed_amount
    FROM orders o
    JOIN statement_reconcile_logs srl ON srl.order_id = o.id
    WHERE o.id = ?
");
$stmt->execute([$orderId]);
$order = $stmt->fetch();

echo "📦 Order Info:\n";
echo "  Order Creator: {$order['creator_id']}\n";
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

echo "📦 Items ({count($items)}):\n";

// Calculate total value
$total_item_value = 0;
foreach ($items as $item) {
    $total_item_value += (float)$item['net_total'];
}

$ratio = $total_item_value > 0 ? $order['confirmed_amount'] / $total_item_value : 0;

echo "  Total Item Value: {$total_item_value}\n";
echo "  Payment Ratio: {$ratio}\n\n";

// Process each item
$salesData = [];
foreach ($items as $item) {
    $skip = false;
    $reason = '';
    
    // Check exclusions
    if ((int)$item['is_freebie'] === 1) {
        $skip = true;
        $reason = 'Freebie';
    } elseif (!empty($item['parent_item_id'])) {
        $skip = true;
        $reason = 'Has Parent (Promotion Child)';
    }
    
    $item_net = (float)$item['net_total'];
    $commissionable_amount = $item_net * $ratio;
    
    if ($commissionable_amount <= 0) {
        $skip = true;
        $reason = 'Amount <= 0';
    }
    
    // Determine beneficiary
    $beneficiary_id = !empty($item['creator_id']) ? $item['creator_id'] : $order['creator_id'];
    
    echo "  Item #{$item['id']}: {$item['product_name']}\n";
    echo "    Net Total: {$item_net}\n";
    echo "    Commissionable: {$commissionable_amount}\n";
    echo "    Creator ID: " . ($item['creator_id'] ?? 'NULL') . "\n";
    echo "    Beneficiary: {$beneficiary_id}\n";
    
    if ($skip) {
        echo "    ❌ SKIP: {$reason}\n\n";
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
    echo "✅ User 1655 SHOULD be in commission records\n";
} else {
    echo "❌ User 1655 NOT in sales data - this is the problem!\n";
}
