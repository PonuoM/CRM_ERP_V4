<?php
/**
 * Debug: Check if Basket 38 customers were previously distributed
 * 
 * ตรวจสอบว่าลูกค้าใน basket 38 เคยถูกแจกไป Telesale แล้วโดนดีดกลับหรือไม่
 */

header('Content-Type: text/plain; charset=utf-8');

require_once __DIR__ . '/../config.php';

$pdo = db_connect();

echo "=====================================================\n";
echo "Check Distribution History for Basket 38 Customers\n";
echo "Date: " . date('Y-m-d H:i:s') . "\n";
echo "=====================================================\n\n";

// Get customers in basket 38 with no owner and check their transition history
$sql = "
    SELECT 
        c.customer_id,
        c.first_name,
        c.last_name,
        c.company_id,
        (
            SELECT GROUP_CONCAT(
                CONCAT(btl.from_basket_key, '→', btl.to_basket_key, ' (', btl.transition_type, ' ', DATE_FORMAT(btl.created_at, '%d/%m %H:%i'), ')')
                ORDER BY btl.created_at
                SEPARATOR ' | '
            )
            FROM basket_transition_log btl 
            WHERE btl.customer_id = c.customer_id
        ) as transition_history,
        (
            SELECT COUNT(*) 
            FROM basket_transition_log btl 
            WHERE btl.customer_id = c.customer_id
        ) as transition_count,
        (
            SELECT COUNT(*) 
            FROM basket_transition_log btl 
            WHERE btl.customer_id = c.customer_id
              AND btl.to_basket_key IN (39, 40, 46, 47, 48, 49, 50)
        ) as was_in_personal_basket,
        (
            SELECT MAX(c2.assigned_to)
            FROM customers c2 
            WHERE c2.customer_id = c.customer_id
        ) as ever_had_owner
    FROM customers c
    WHERE c.current_basket_key = 38
      AND (c.assigned_to IS NULL OR c.assigned_to = 0)
    ORDER BY c.customer_id DESC
    LIMIT 200
";

$customers = $pdo->query($sql)->fetchAll(PDO::FETCH_ASSOC);

$stats = [
    'total' => 0,
    'no_history' => 0,
    'has_history' => 0,
    'was_distributed' => 0,
    'was_personal' => 0
];

echo "=== CUSTOMERS WITH TRANSITION HISTORY ===\n";
echo "-----------------------------------------------------\n\n";

$distributedCustomers = [];
$personalCustomers = [];

foreach ($customers as $c) {
    $stats['total']++;
    
    if ($c['transition_count'] == 0) {
        $stats['no_history']++;
        continue;
    }
    
    $stats['has_history']++;
    
    // Check if was ever distributed (moved to distribution baskets 41-45, 52, 53)
    $wasDistributed = strpos($c['transition_history'], '→41') !== false 
                   || strpos($c['transition_history'], '→42') !== false
                   || strpos($c['transition_history'], '→43') !== false
                   || strpos($c['transition_history'], '→44') !== false
                   || strpos($c['transition_history'], '→45') !== false
                   || strpos($c['transition_history'], '→52') !== false
                   || strpos($c['transition_history'], '→53') !== false;
    
    // Check if was ever in personal baskets (39, 40, etc.)
    if ($c['was_in_personal_basket'] > 0) {
        $stats['was_personal']++;
        $personalCustomers[] = $c;
    }
    
    if ($wasDistributed) {
        $stats['was_distributed']++;
        $distributedCustomers[] = $c;
    }
}

// Show customers that were in personal baskets
echo "=== CUSTOMERS THAT WERE IN PERSONAL BASKETS (Bounced Back) ===\n";
echo "These were distributed, assigned, then returned to 38\n";
echo "-----------------------------------------------------\n\n";

foreach ($personalCustomers as $c) {
    $name = trim($c['first_name'] . ' ' . $c['last_name']);
    echo "[{$c['customer_id']}] $name (Company {$c['company_id']})\n";
    echo "    History: {$c['transition_history']}\n\n";
}

echo "\n=== CUSTOMERS THAT WERE DISTRIBUTED ===\n";
echo "These were in distribution baskets at some point\n";
echo "-----------------------------------------------------\n\n";

$count = 0;
foreach ($distributedCustomers as $c) {
    if ($count >= 50) {
        echo "... and " . (count($distributedCustomers) - 50) . " more\n";
        break;
    }
    $name = trim($c['first_name'] . ' ' . $c['last_name']);
    echo "[{$c['customer_id']}] $name\n";
    echo "    History: {$c['transition_history']}\n\n";
    $count++;
}

echo "=====================================================\n";
echo "SUMMARY (from 200 samples)\n";
echo "=====================================================\n";
echo "Total analyzed:         {$stats['total']}\n";
echo "No transition history:  {$stats['no_history']}\n";
echo "Has transition history: {$stats['has_history']}\n";
echo "Was in Personal basket: {$stats['was_personal']} ← BOUNCED BACK!\n";
echo "Was in Distribution:    {$stats['was_distributed']}\n";
echo "=====================================================\n";

// Full count for entire basket 38
echo "\n=== FULL COUNT (All basket 38 no-owner) ===\n";

$fullSql = "
    SELECT 
        COUNT(DISTINCT c.customer_id) as total,
        SUM(CASE WHEN (
            SELECT COUNT(*) FROM basket_transition_log btl 
            WHERE btl.customer_id = c.customer_id
        ) > 0 THEN 1 ELSE 0 END) as has_history,
        SUM(CASE WHEN (
            SELECT COUNT(*) FROM basket_transition_log btl 
            WHERE btl.customer_id = c.customer_id
              AND btl.to_basket_key IN (39, 40, 46, 47, 48, 49, 50)
        ) > 0 THEN 1 ELSE 0 END) as was_personal
    FROM customers c
    WHERE c.current_basket_key = 38
      AND (c.assigned_to IS NULL OR c.assigned_to = 0)
";

$fullStats = $pdo->query($fullSql)->fetch(PDO::FETCH_ASSOC);

echo "Total in basket 38 (no owner):  {$fullStats['total']}\n";
echo "Has any transition history:     {$fullStats['has_history']}\n";
echo "Was ever in Personal basket:    {$fullStats['was_personal']} ← BOUNCED BACK\n";
echo "=====================================================\n";
