<?php
/**
 * Debug: Analyze Basket 38 No-Owner Customers
 * 
 * แสดงข้อมูลลูกค้าใน basket 38 ที่ไม่มี owner พร้อมข้อมูล:
 * - แยกตาม Company
 * - Order ล่าสุด
 * - ใครเป็นผู้ขาย (จาก order_items)
 * - มี Telesale ขายหรือไม่ (role 6,7)
 */

header('Content-Type: text/plain; charset=utf-8');

require_once __DIR__ . '/../config.php';

$pdo = db_connect();

echo "=====================================================\n";
echo "Analyze Basket 38 No-Owner Customers\n";
echo "Date: " . date('Y-m-d H:i:s') . "\n";
echo "=====================================================\n\n";

// === COMPANY BREAKDOWN ===
echo "=== BREAKDOWN BY COMPANY ===\n";
echo "-----------------------------------------------------\n";

$companySql = "
    SELECT 
        co.id as company_id,
        co.name as company_name,
        COUNT(c.customer_id) as customer_count
    FROM customers c
    LEFT JOIN companies co ON c.company_id = co.id
    WHERE c.current_basket_key = 38
      AND (c.assigned_to IS NULL OR c.assigned_to = 0)
    GROUP BY co.id, co.name
    ORDER BY customer_count DESC
";
$companyStats = $pdo->query($companySql)->fetchAll(PDO::FETCH_ASSOC);

$totalByCompany = 0;
foreach ($companyStats as $cs) {
    echo "  Company {$cs['company_id']} ({$cs['company_name']}): {$cs['customer_count']} customers\n";
    $totalByCompany += $cs['customer_count'];
}
echo "-----------------------------------------------------\n";
echo "TOTAL: $totalByCompany customers\n\n";

// Get customers in basket 38 with no owner
$customerSql = "
    SELECT 
        c.customer_id,
        c.first_name,
        c.last_name,
        c.current_basket_key,
        c.basket_entered_date
    FROM customers c
    WHERE c.current_basket_key = 38
      AND (c.assigned_to IS NULL OR c.assigned_to = 0)
    ORDER BY c.basket_entered_date DESC
    LIMIT 100
";

$customers = $pdo->query($customerSql)->fetchAll(PDO::FETCH_ASSOC);

echo "Showing first 100 customers (of 1708 total):\n";
echo "-----------------------------------------------------\n\n";

// Stats
$stats = [
    'total' => 0,
    'has_telesale_item' => 0,
    'no_telesale_item' => 0,
    'no_orders' => 0
];

foreach ($customers as $c) {
    $stats['total']++;
    $customerId = $c['customer_id'];
    $name = trim($c['first_name'] . ' ' . $c['last_name']);
    
    // Get last order
    $orderSql = "
        SELECT o.id, o.order_date, o.order_status, o.creator_id, u.first_name as creator_name, u.role_id
        FROM orders o
        LEFT JOIN users u ON o.creator_id = u.id
        WHERE o.customer_id = ?
        ORDER BY o.order_date DESC
        LIMIT 1
    ";
    $orderStmt = $pdo->prepare($orderSql);
    $orderStmt->execute([$customerId]);
    $lastOrder = $orderStmt->fetch(PDO::FETCH_ASSOC);
    
    // Check for Telesale involvement in order_items
    $telesaleItemSql = "
        SELECT oi.id, oi.creator_id, u.first_name as creator_name, u.role_id, oi.parent_order_id
        FROM order_items oi
        INNER JOIN orders o ON oi.parent_order_id = o.id
        INNER JOIN users u ON oi.creator_id = u.id
        WHERE o.customer_id = ?
          AND u.role_id IN (6, 7)
        ORDER BY oi.id DESC
        LIMIT 5
    ";
    $telesaleStmt = $pdo->prepare($telesaleItemSql);
    $telesaleStmt->execute([$customerId]);
    $telesaleItems = $telesaleStmt->fetchAll(PDO::FETCH_ASSOC);
    
    $hasTelesale = count($telesaleItems) > 0;
    
    echo "[$customerId] $name\n";
    echo "    Basket entered: {$c['basket_entered_date']}\n";
    
    if ($lastOrder) {
        $roleLabel = ($lastOrder['role_id'] == 6 || $lastOrder['role_id'] == 7) ? 'TELESALE' : 'ADMIN';
        echo "    Last Order: #{$lastOrder['id']} ({$lastOrder['order_status']}) - {$lastOrder['order_date']}\n";
        echo "    Order Creator: {$lastOrder['creator_name']} (role {$lastOrder['role_id']} = $roleLabel)\n";
    } else {
        echo "    Last Order: NONE\n";
        $stats['no_orders']++;
    }
    
    if ($hasTelesale) {
        $stats['has_telesale_item']++;
        echo "    🔵 HAS TELESALE ITEMS:\n";
        foreach ($telesaleItems as $ti) {
            echo "        - Item by {$ti['creator_name']} (role {$ti['role_id']}) in order #{$ti['parent_order_id']}\n";
        }
        echo "    → SHOULD GO TO: basket 39 (Personal 1-2M)\n";
    } else {
        $stats['no_telesale_item']++;
        echo "    ⚪ No Telesale items\n";
        echo "    → SHOULD GO TO: basket 52 (Distribution New Customer)\n";
    }
    
    echo "\n";
}

echo "=====================================================\n";
echo "SUMMARY (from 100 samples)\n";
echo "=====================================================\n";
echo "Total analyzed:      {$stats['total']}\n";
echo "Has Telesale items:  {$stats['has_telesale_item']} → Should go to 39\n";
echo "No Telesale items:   {$stats['no_telesale_item']} → Should go to 52\n";
echo "No orders at all:    {$stats['no_orders']} → Should go to 52\n";
echo "=====================================================\n";

// Get full stats for ALL customers per company
echo "\n=== FULL STATS BY COMPANY ===\n";

foreach ($companyStats as $cs) {
    $companyId = $cs['company_id'];
    $companyName = $cs['company_name'];
    
    $fullStatsSql = "
        SELECT 
            c.customer_id,
            (SELECT COUNT(*) FROM order_items oi 
             INNER JOIN orders o ON oi.parent_order_id = o.id 
             INNER JOIN users u ON oi.creator_id = u.id 
             WHERE o.customer_id = c.customer_id AND u.role_id IN (6,7)) as telesale_items
        FROM customers c
        WHERE c.current_basket_key = 38
          AND (c.assigned_to IS NULL OR c.assigned_to = 0)
          AND c.company_id = ?
    ";
    $stmt = $pdo->prepare($fullStatsSql);
    $stmt->execute([$companyId]);
    $fullStats = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    $countWithTelesale = 0;
    $countWithoutTelesale = 0;
    
    foreach ($fullStats as $fs) {
        if ($fs['telesale_items'] > 0) {
            $countWithTelesale++;
        } else {
            $countWithoutTelesale++;
        }
    }
    
    $total = $countWithTelesale + $countWithoutTelesale;
    
    echo "-----------------------------------------------------\n";
    echo "Company $companyId ($companyName) - Total: $total\n";
    echo "  WITH Telesale items:    $countWithTelesale → Should move to 39\n";
    echo "  WITHOUT Telesale items: $countWithoutTelesale → Should move to 52\n";
}

echo "=====================================================\n";
