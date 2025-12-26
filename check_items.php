<?php
require 'api/config.php';
$pdo = db_connect();

$orderId = '251226-00023adminga';

echo "🔍 Checking Order Items for: {$orderId}\n";
echo "==========================================\n\n";

// Get items
$stmt = $pdo->prepare("
    SELECT 
        id, 
        creator_id, 
        net_total, 
        is_freebie, 
        parent_item_id,
        product_name,
        quantity
    FROM order_items 
    WHERE order_id = ?
");
$stmt->execute([$orderId]);
$items = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo "📦 Items Found: " . count($items) . "\n\n";

if (count($items) === 0) {
    echo "❌ NO ITEMS FOUND!\n";
    echo "   This is why commission = 0\n";
    echo "   Orders without items are skipped in commission calculation\n";
    exit;
}

echo "Items:\n";
foreach ($items as $item) {
    echo "  ID: {$item['id']}\n";
    echo "    Product: {$item['product_name']}\n";
    echo "    Quantity: {$item['quantity']}\n";
    echo "    Net Total: {$item['net_total']}\n";
    echo "    Creator ID: " . ($item['creator_id'] ?? 'NULL') . "\n";
    echo "    Is Freebie: {$item['is_freebie']}\n";
    echo "    Parent Item ID: " . ($item['parent_item_id'] ?? 'NULL') . "\n";
    
    // Check if commissionable
    $skip = false;
    $reason = '';
    
    if ((int)$item['is_freebie'] === 1) {
        $skip = true;
        $reason = 'Is Freebie';
    } elseif (!empty($item['parent_item_id'])) {
        $skip = true;
        $reason = 'Has Parent (Promotion Child)';
    } elseif ((float)$item['net_total'] <= 0) {
        $skip = true;
        $reason = 'Net Total <= 0';
    }
    
    if ($skip) {
        echo "    ❌ SKIP: {$reason}\n";
    } else {
        echo "    ✅ COMMISSIONABLE\n";
    }
    echo "\n";
}

// Summary
$commissionableItems = array_filter($items, function($item) {
    return (int)$item['is_freebie'] !== 1 
        && empty($item['parent_item_id']) 
        && (float)$item['net_total'] > 0;
});

echo "📊 Summary:\n";
echo "  Total Items: " . count($items) . "\n";
echo "  Commissionable Items: " . count($commissionableItems) . "\n";

if (count($commissionableItems) === 0) {
    echo "\n❌ NO COMMISSIONABLE ITEMS!\n";
    echo "   This is why this order gets total_sales = 0\n";
}
