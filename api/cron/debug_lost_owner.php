<?php
/**
 * Debug: Find customers who LOST their assigned_to
 * 
 * ค้นหาลูกค้าที่เคยมี owner แต่ assigned_to กลายเป็น NULL
 * โดยดูจาก:
 * 1. basket_transition_log - เคยถูกย้ายโดย Telesale
 * 2. orders - มี Order ที่สร้างโดย Telesale
 * 3. call_logs - มีประวัติโทรโดย Telesale
 */

header('Content-Type: text/plain; charset=utf-8');

require_once __DIR__ . '/../config.php';

$pdo = db_connect();

echo "=====================================================\n";
echo "Find Customers Who LOST Their Assigned Owner\n";
echo "Date: " . date('Y-m-d H:i:s') . "\n";
echo "=====================================================\n\n";

// Method 1: Check customers in basket 38 who have orders created by Telesale (role 6,7)
echo "=== METHOD 1: Orders Created by Telesale ===\n";
echo "Customers in basket 38 (no owner) but have orders from Telesale\n";
echo "-----------------------------------------------------\n\n";

$sql1 = "
    SELECT DISTINCT
        c.customer_id,
        c.first_name,
        c.last_name,
        c.company_id,
        c.current_basket_key,
        c.assigned_to,
        (
            SELECT GROUP_CONCAT(DISTINCT u.first_name ORDER BY o.order_date DESC SEPARATOR ', ')
            FROM orders o
            INNER JOIN users u ON o.creator_id = u.id
            WHERE o.customer_id = c.customer_id AND u.role_id IN (6, 7)
            LIMIT 5
        ) as telesale_creators,
        (
            SELECT COUNT(*) 
            FROM orders o
            INNER JOIN users u ON o.creator_id = u.id
            WHERE o.customer_id = c.customer_id AND u.role_id IN (6, 7)
        ) as telesale_order_count,
        (
            SELECT MAX(o.order_date)
            FROM orders o
            INNER JOIN users u ON o.creator_id = u.id
            WHERE o.customer_id = c.customer_id AND u.role_id IN (6, 7)
        ) as last_telesale_order
    FROM customers c
    WHERE c.current_basket_key = 38
      AND (c.assigned_to IS NULL OR c.assigned_to = 0)
    HAVING telesale_order_count > 0
    ORDER BY telesale_order_count DESC
    LIMIT 50
";

$results1 = $pdo->query($sql1)->fetchAll(PDO::FETCH_ASSOC);
echo "Found: " . count($results1) . " customers\n\n";

foreach ($results1 as $r) {
    $name = trim($r['first_name'] . ' ' . $r['last_name']);
    echo "[{$r['customer_id']}] $name (Company {$r['company_id']})\n";
    echo "    Telesale orders: {$r['telesale_order_count']} by {$r['telesale_creators']}\n";
    echo "    Last Telesale order: {$r['last_telesale_order']}\n\n";
}

// Method 2: Check call_logs by Telesale
echo "\n=== METHOD 2: Call Logs by Telesale ===\n";
echo "Customers in basket 38 (no owner) but have call logs from Telesale\n";
echo "-----------------------------------------------------\n\n";

$sql2 = "
    SELECT DISTINCT
        c.customer_id,
        c.first_name,
        c.last_name,
        c.company_id,
        (
            SELECT COUNT(*) 
            FROM call_logs cl
            INNER JOIN users u ON cl.user_id = u.id
            WHERE cl.customer_id = c.customer_id AND u.role_id IN (6, 7)
        ) as telesale_call_count,
        (
            SELECT MAX(cl.created_at)
            FROM call_logs cl
            INNER JOIN users u ON cl.user_id = u.id
            WHERE cl.customer_id = c.customer_id AND u.role_id IN (6, 7)
        ) as last_telesale_call,
        (
            SELECT GROUP_CONCAT(DISTINCT u.first_name ORDER BY cl.created_at DESC SEPARATOR ', ')
            FROM call_logs cl
            INNER JOIN users u ON cl.user_id = u.id
            WHERE cl.customer_id = c.customer_id AND u.role_id IN (6, 7)
            LIMIT 5
        ) as telesale_callers
    FROM customers c
    WHERE c.current_basket_key = 38
      AND (c.assigned_to IS NULL OR c.assigned_to = 0)
    HAVING telesale_call_count > 0
    ORDER BY telesale_call_count DESC
    LIMIT 50
";

$results2 = $pdo->query($sql2)->fetchAll(PDO::FETCH_ASSOC);
echo "Found: " . count($results2) . " customers\n\n";

foreach ($results2 as $r) {
    $name = trim($r['first_name'] . ' ' . $r['last_name']);
    echo "[{$r['customer_id']}] $name (Company {$r['company_id']})\n";
    echo "    Telesale calls: {$r['telesale_call_count']} by {$r['telesale_callers']}\n";
    echo "    Last Telesale call: {$r['last_telesale_call']}\n\n";
}

// Method 3: Check transition_log where triggered_by is Telesale
echo "\n=== METHOD 3: Transitions Triggered by Telesale ===\n";
echo "Customers in basket 38 (no owner) but have transitions by Telesale\n";
echo "-----------------------------------------------------\n\n";

$sql3 = "
    SELECT DISTINCT
        c.customer_id,
        c.first_name,
        c.last_name,
        c.company_id,
        (
            SELECT COUNT(*) 
            FROM basket_transition_log btl
            INNER JOIN users u ON btl.triggered_by = u.id
            WHERE btl.customer_id = c.customer_id AND u.role_id IN (6, 7)
        ) as telesale_transition_count,
        (
            SELECT GROUP_CONCAT(
                CONCAT(btl.from_basket_key, '→', btl.to_basket_key, ' by ', u.first_name)
                ORDER BY btl.created_at DESC
                SEPARATOR ' | '
            )
            FROM basket_transition_log btl
            INNER JOIN users u ON btl.triggered_by = u.id
            WHERE btl.customer_id = c.customer_id AND u.role_id IN (6, 7)
            LIMIT 5
        ) as telesale_transitions
    FROM customers c
    WHERE c.current_basket_key = 38
      AND (c.assigned_to IS NULL OR c.assigned_to = 0)
    HAVING telesale_transition_count > 0
    ORDER BY telesale_transition_count DESC
    LIMIT 50
";

$results3 = $pdo->query($sql3)->fetchAll(PDO::FETCH_ASSOC);
echo "Found: " . count($results3) . " customers\n\n";

foreach ($results3 as $r) {
    $name = trim($r['first_name'] . ' ' . $r['last_name']);
    echo "[{$r['customer_id']}] $name (Company {$r['company_id']})\n";
    echo "    Transitions by Telesale: {$r['telesale_transition_count']}\n";
    echo "    Details: {$r['telesale_transitions']}\n\n";
}

// Summary
echo "=====================================================\n";
echo "SUMMARY\n";
echo "=====================================================\n";
echo "Customers in basket 38 with Telesale orders:       " . count($results1) . "\n";
echo "Customers in basket 38 with Telesale calls:        " . count($results2) . "\n";
echo "Customers in basket 38 with Telesale transitions:  " . count($results3) . "\n";
echo "=====================================================\n";

// Full count
echo "\n=== FULL COUNT ===\n";

$fullSql = "
    SELECT 
        (SELECT COUNT(DISTINCT c.customer_id)
         FROM customers c
         INNER JOIN orders o ON c.customer_id = o.customer_id
         INNER JOIN users u ON o.creator_id = u.id
         WHERE c.current_basket_key = 38
           AND (c.assigned_to IS NULL OR c.assigned_to = 0)
           AND u.role_id IN (6, 7)) as with_telesale_orders,
           
        (SELECT COUNT(DISTINCT c.customer_id)
         FROM customers c
         INNER JOIN call_logs cl ON c.customer_id = cl.customer_id
         INNER JOIN users u ON cl.user_id = u.id
         WHERE c.current_basket_key = 38
           AND (c.assigned_to IS NULL OR c.assigned_to = 0)
           AND u.role_id IN (6, 7)) as with_telesale_calls
";

$fullStats = $pdo->query($fullSql)->fetch(PDO::FETCH_ASSOC);

echo "TOTAL with Telesale orders (ALL): {$fullStats['with_telesale_orders']}\n";
echo "TOTAL with Telesale calls (ALL):  {$fullStats['with_telesale_calls']}\n";
echo "-----------------------------------------------------\n";
echo "These customers likely LOST their assigned_to!\n";
echo "=====================================================\n";
