<?php
require 'api/config.php';
$pdo = db_connect();

$orderId = '251226-00023adminga';

// 1. Check if order exists
$stmt = $pdo->prepare('SELECT id, order_date, company_id, creator_id, total_amount FROM orders WHERE id = ?');
$stmt->execute([$orderId]);
$order = $stmt->fetch();

if (!$order) {
    echo "❌ Order not found\n";
    exit;
}

echo "📦 Order Information:\n";
echo "   ID: {$order['id']}\n";
echo "   Date: {$order['order_date']}\n";
echo "   Company: {$order['company_id']}\n";
echo "   Creator: {$order['creator_id']}\n";
echo "   Total: {$order['total_amount']}\n\n";

// 2. Check reconcile status
$stmt = $pdo->prepare('SELECT confirmed_action, confirmed_amount, confirmed_at FROM statement_reconcile_logs WHERE order_id = ?');
$stmt->execute([$orderId]);
$reconcile = $stmt->fetch();

echo "💰 Reconcile Status:\n";
if ($reconcile) {
    echo "   Action: {$reconcile['confirmed_action']}\n";
    echo "   Amount: {$reconcile['confirmed_amount']}\n";
    echo "   Confirmed At: {$reconcile['confirmed_at']}\n";
    $isConfirmed = $reconcile['confirmed_action'] === 'Confirmed';
    echo "   " . ($isConfirmed ? '✅' : '❌') . " Reconcile Confirmed\n\n";
} else {
    echo "   ❌ No reconcile record found\n\n";
    $isConfirmed = false;
}

// 3. Check if already calculated
$stmt = $pdo->prepare('SELECT id FROM commission_order_lines WHERE order_id = ?');
$stmt->execute([$orderId]);
$alreadyCalculated = $stmt->fetch();

echo "🧮 Commission Status:\n";
if ($alreadyCalculated) {
    echo "   ❌ Already calculated (ID: {$alreadyCalculated['id']})\n\n";
} else {
    echo "   ✅ Not yet calculated\n\n";
}

// 4. Determine period
$orderDate = new DateTime($order['order_date']);
$nextMonth = clone $orderDate;
$nextMonth->modify('+1 month');
$periodYear = (int)$nextMonth->format('Y');
$periodMonth = (int)$nextMonth->format('m');

echo "📅 Commission Period:\n";
echo "   Order Month: " . $orderDate->format('F Y') . "\n";
echo "   Commission Period: " . $nextMonth->format('F Y') . " (Period {$periodMonth}/{$periodYear})\n\n";

// 5. Summary
echo "📊 Eligibility Summary:\n";
echo "   " . ($order ? '✅' : '❌') . " Order exists\n";
echo "   " . ($isConfirmed ? '✅' : '❌') . " Reconcile confirmed\n";
echo "   " . (!$alreadyCalculated ? '✅' : '❌') . " Not yet calculated\n";
echo "   " . ($order['company_id'] ? '✅' : '❌') . " Has company_id\n\n";

$eligible = $order && $isConfirmed && !$alreadyCalculated && $order['company_id'];
echo $eligible ? "✅ ELIGIBLE for commission calculation\n" : "❌ NOT ELIGIBLE for commission calculation\n";
echo "   Will be included in: " . $nextMonth->format('F Y') . " period\n";
