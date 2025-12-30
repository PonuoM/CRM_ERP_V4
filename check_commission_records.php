<?php
require 'api/config.php';
$pdo = db_connect();

// Get latest commission period
$stmt = $pdo->prepare("
    SELECT id, period_month, period_year 
    FROM commission_periods 
    ORDER BY id DESC 
    LIMIT 1
");
$stmt->execute();
$period = $stmt->fetch();

if (!$period) {
    echo "❌ No commission period found\n";
    exit;
}

echo "🔍 Checking Commission Period #{$period['id']}\n";
echo "Period: {$period['period_month']}/{$period['period_year']}\n";
echo "==========================================\n\n";

// Get all commission records
$stmt = $pdo->prepare("
    SELECT 
        cr.id,
        cr.user_id,
        u.username,
        cr.total_sales,
        cr.commission_amount,
        cr.order_count
    FROM commission_records cr
    LEFT JOIN users u ON u.id = cr.user_id
    WHERE cr.period_id = ?
    ORDER BY cr.total_sales DESC
");
$stmt->execute([$period['id']]);
$records = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo "📊 Commission Records: " . count($records) . "\n\n";

foreach ($records as $record) {
    echo "User #{$record['user_id']}: {$record['username']}\n";
    echo "  Total Sales: {$record['total_sales']}\n";
    echo "  Commission: {$record['commission_amount']}\n";
    echo "  Orders: {$record['order_count']}\n";
    
    // Get order lines for this user
    $stmt = $pdo->prepare("
        SELECT order_id, order_amount, commission_amount
        FROM commission_order_lines
        WHERE record_id = ?
    ");
    $stmt->execute([$record['id']]);
    $lines = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "  Order Lines: " . count($lines) . "\n";
    foreach ($lines as $line) {
        echo "    - {$line['order_id']}: {$line['order_amount']} (Commission: {$line['commission_amount']})\n";
    }
    echo "\n";
}

// Check if User 1655 is in the records
$user1655 = array_filter($records, function($r) { return $r['user_id'] == 1655; });
if (empty($user1655)) {
    echo "❌ User 1655 NOT FOUND in commission records!\n";
    echo "   This is the problem - upsell user is missing\n\n";
    
    // Check what items User 1655 created
    echo "🔍 Checking items created by User 1655:\n";
    $stmt = $pdo->prepare("
        SELECT oi.*, o.order_date
        FROM order_items oi
        JOIN orders o ON o.id = oi.parent_order_id
        WHERE oi.creator_id = 1655
        AND o.order_date < '2026-01-01'
        LIMIT 5
    ");
    $stmt->execute();
    $items = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    foreach ($items as $item) {
        echo "  Order: {$item['parent_order_id']}, Date: {$item['order_date']}\n";
        echo "    Product: {$item['product_name']}\n";
        echo "    Net Total: {$item['net_total']}\n";
        echo "    Is Freebie: {$item['is_freebie']}\n";
        echo "    Parent Item: " . ($item['parent_item_id'] ?? 'NULL') . "\n\n";
    }
} else {
    echo "✅ User 1655 found in records\n";
}
