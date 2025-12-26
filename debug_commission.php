<?php
require 'api/config.php';
$pdo = db_connect();

$company_id = 1;
$period_month = 1;
$period_year = 2026;

// Calculate period_start (same logic as calculate_commission.php)
$period_start_date = sprintf('%04d-%02d-01', $period_year, $period_month);

echo "🔍 Debugging Commission Calculation\n";
echo "=====================================\n\n";
echo "Parameters:\n";
echo "  Company ID: {$company_id}\n";
echo "  Period: {$period_month}/{$period_year}\n";
echo "  Period Start: {$period_start_date}\n\n";

// Run the exact same query as calculate_commission.php
$ordersStmt = $pdo->prepare("
    SELECT 
        o.id,
        o.creator_id as order_creator_id,
        o.order_date,
        srl.confirmed_amount,
        srl.confirmed_at
    FROM orders o
    INNER JOIN statement_reconcile_logs srl ON srl.order_id = o.id
    LEFT JOIN commission_order_lines col ON col.order_id = o.id
    WHERE 
        srl.confirmed_action = 'Confirmed'
        AND o.order_date < :period_start
        AND col.id IS NULL
        AND o.company_id = :company_id
    ORDER BY o.order_date
");

$ordersStmt->execute([
    'period_start' => $period_start_date,
    'company_id' => $company_id
]);

$orders = $ordersStmt->fetchAll(PDO::FETCH_ASSOC);

echo "📊 Query Results:\n";
echo "  Found Orders: " . count($orders) . "\n\n";

if (count($orders) > 0) {
    echo "Orders:\n";
    foreach ($orders as $order) {
        echo "  - {$order['id']}: {$order['order_date']} | Amount: {$order['confirmed_amount']}\n";
    }
} else {
    echo "❌ No orders found!\n\n";
    
    // Debug each condition separately
    echo "🔍 Debugging Each Condition:\n\n";
    
    // 1. Orders with reconcile
    $stmt = $pdo->prepare("
        SELECT COUNT(*) as count
        FROM orders o
        INNER JOIN statement_reconcile_logs srl ON srl.order_id = o.id
        WHERE o.company_id = ?
    ");
    $stmt->execute([$company_id]);
    $count1 = $stmt->fetch()['count'];
    echo "1. Orders with reconcile logs: {$count1}\n";
    
    // 2. Orders with Confirmed reconcile
    $stmt = $pdo->prepare("
        SELECT COUNT(*) as count
        FROM orders o
        INNER JOIN statement_reconcile_logs srl ON srl.order_id = o.id
        WHERE srl.confirmed_action = 'Confirmed'
        AND o.company_id = ?
    ");
    $stmt->execute([$company_id]);
    $count2 = $stmt->fetch()['count'];
    echo "2. Orders with Confirmed reconcile: {$count2}\n";
    
    // 3. Orders before period_start
    $stmt = $pdo->prepare("
        SELECT COUNT(*) as count
        FROM orders o
        INNER JOIN statement_reconcile_logs srl ON srl.order_id = o.id
        WHERE srl.confirmed_action = 'Confirmed'
        AND o.order_date < ?
        AND o.company_id = ?
    ");
    $stmt->execute([$period_start_date, $company_id]);
    $count3 = $stmt->fetch()['count'];
    echo "3. Orders before {$period_start_date}: {$count3}\n";
    
    // 4. Orders not yet calculated
    $stmt = $pdo->prepare("
        SELECT COUNT(*) as count
        FROM orders o
        INNER JOIN statement_reconcile_logs srl ON srl.order_id = o.id
        LEFT JOIN commission_order_lines col ON col.order_id = o.id
        WHERE srl.confirmed_action = 'Confirmed'
        AND o.order_date < ?
        AND col.id IS NULL
        AND o.company_id = ?
    ");
    $stmt->execute([$period_start_date, $company_id]);
    $count4 = $stmt->fetch()['count'];
    echo "4. Orders not yet calculated: {$count4}\n\n";
    
    // Check specific order
    echo "🔍 Checking Order: 251226-00023adminga\n";
    $orderId = '251226-00023adminga';
    
    $stmt = $pdo->prepare("SELECT order_date FROM orders WHERE id = ?");
    $stmt->execute([$orderId]);
    $orderDate = $stmt->fetch();
    echo "  Order Date: " . ($orderDate ? $orderDate['order_date'] : 'NOT FOUND') . "\n";
    echo "  Period Start: {$period_start_date}\n";
    
    if ($orderDate) {
        $comparison = $orderDate['order_date'] < $period_start_date ? 'BEFORE' : 'AFTER/EQUAL';
        echo "  Comparison: {$orderDate['order_date']} is {$comparison} {$period_start_date}\n";
        
        if ($comparison === 'AFTER/EQUAL') {
            echo "  ❌ PROBLEM: Order date is NOT before period_start!\n";
        }
    }
}
