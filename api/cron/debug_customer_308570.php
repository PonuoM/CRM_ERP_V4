<?php
/**
 * Debug script for customer 308570 - check ALL conditions for upsell_exit_handler
 */

require_once __DIR__ . '/../config.php';

header('Content-Type: text/plain; charset=utf-8');

$pdo = db_connect();
$targetCustomerId = 308570;

echo "=== DEBUG: Customer $targetCustomerId - Upsell Exit Eligibility ===\n";
echo "Time: " . date('Y-m-d H:i:s') . "\n\n";

// 1. Customer data
echo "1. CUSTOMER DATA:\n";
$stmt = $pdo->prepare("
    SELECT 
        customer_id,
        customer_ref_id,
        first_name,
        last_name,
        phone,
        current_basket_key,
        assigned_to,
        company_id
    FROM customers 
    WHERE customer_id = ?
");
$stmt->execute([$targetCustomerId]);
$customer = $stmt->fetch(PDO::FETCH_ASSOC);

if ($customer) {
    foreach ($customer as $key => $value) {
        echo "   $key: " . ($value ?? 'NULL') . "\n";
    }
    
    // Check conditions
    echo "\n   === Condition Checks ===\n";
    echo "   - company_id = 1? " . ($customer['company_id'] == 1 ? '✅ YES' : '❌ NO (' . $customer['company_id'] . ')') . "\n";
    echo "   - assigned_to NULL or 0? " . (($customer['assigned_to'] === null || $customer['assigned_to'] == 0) ? '✅ YES' : '❌ NO (' . $customer['assigned_to'] . ')') . "\n";
    echo "   - current_basket_key = 53 or NULL or 0? ";
    if ($customer['current_basket_key'] == 53 || $customer['current_basket_key'] === null || $customer['current_basket_key'] == 0) {
        echo "✅ YES (" . ($customer['current_basket_key'] ?? 'NULL') . ")\n";
    } else {
        echo "❌ NO (" . $customer['current_basket_key'] . ")\n";
    }
} else {
    echo "   ❌ CUSTOMER NOT FOUND!\n";
}

// 2. Orders for this customer
echo "\n2. ORDERS FOR THIS CUSTOMER (last 7 days):\n";
$stmt = $pdo->prepare("
    SELECT 
        o.id as order_id,
        o.customer_id as order_customer_id,
        o.order_status,
        o.order_date,
        o.creator_id,
        u.role_id as creator_role,
        u.first_name as creator_name,
        DATEDIFF(NOW(), o.order_date) as days_ago
    FROM orders o
    LEFT JOIN users u ON o.creator_id = u.id
    WHERE o.order_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      AND (o.customer_id = ? OR o.customer_id = ?)
    ORDER BY o.order_date DESC
");
$stmt->execute([$targetCustomerId, $customer['customer_ref_id'] ?? '']);
$orders = $stmt->fetchAll(PDO::FETCH_ASSOC);

if (count($orders) > 0) {
    foreach ($orders as $i => $order) {
        echo "   Order #" . ($i+1) . ":\n";
        foreach ($order as $key => $value) {
            echo "      $key: " . ($value ?? 'NULL') . "\n";
        }
        
        // Check conditions
        echo "\n      === Order Condition Checks ===\n";
        echo "      - order_status = 'Picking'? " . ($order['order_status'] === 'Picking' ? '✅ YES' : '❌ NO (' . $order['order_status'] . ')') . "\n";
        echo "      - creator_role NOT IN (6, 7)? " . (!in_array($order['creator_role'], [6, 7]) ? '✅ YES' : '❌ NO (role=' . $order['creator_role'] . ')') . "\n";
        echo "      - days_ago <= 7? " . ($order['days_ago'] <= 7 ? '✅ YES' : '❌ NO (' . $order['days_ago'] . ' days)') . "\n";
        echo "\n";
    }
} else {
    echo "   ❌ NO ORDERS FOUND in last 7 days!\n";
    
    // Check if customer_id format matches
    echo "\n   Checking all orders for customer_ref_id match:\n";
    $stmt = $pdo->prepare("
        SELECT o.id, o.customer_id, o.order_status, o.order_date
        FROM orders o
        WHERE o.order_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        ORDER BY o.order_date DESC
        LIMIT 20
    ");
    $stmt->execute();
    $recentOrders = $stmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($recentOrders as $ro) {
        echo "   Order {$ro['id']}: customer_id={$ro['customer_id']}, status={$ro['order_status']}\n";
    }
}

// 3. Run the exact query from cron job
echo "\n3. EXACT CRON QUERY RESULT:\n";
$exitSql = "
    SELECT DISTINCT 
        c.customer_id, 
        c.customer_ref_id,
        c.first_name,
        c.last_name,
        c.phone,
        c.current_basket_key,
        c.assigned_to,
        o.order_status, 
        o.id as order_id,
        o.customer_id as order_customer_id,
        o.order_date,
        u.role_id as creator_role,
        DATEDIFF(NOW(), o.order_date) as days_ago
    FROM customers c
    INNER JOIN orders o ON (o.customer_id = c.customer_id OR o.customer_id = c.customer_ref_id)
    INNER JOIN users u ON o.creator_id = u.id
    WHERE c.company_id = 1
      AND (c.assigned_to IS NULL OR c.assigned_to = 0)
      AND o.order_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      AND u.role_id NOT IN (6, 7)
      AND o.order_status = 'Picking'
      AND (c.current_basket_key = 53 OR c.current_basket_key IS NULL OR c.current_basket_key = 0)
    ORDER BY o.order_date DESC
";

$stmt = $pdo->query($exitSql);
$results = $stmt->fetchAll(PDO::FETCH_ASSOC);

if (count($results) > 0) {
    echo "   ✅ Found " . count($results) . " customers eligible:\n";
    foreach ($results as $r) {
        echo "   - Customer {$r['customer_id']} ({$r['first_name']} {$r['last_name']}), Basket: {$r['current_basket_key']}, Order: {$r['order_id']}, Status: {$r['order_status']}\n";
    }
} else {
    echo "   ❌ NO CUSTOMERS FOUND!\n";
    
    // Now check each condition separately
    echo "\n   Breaking down conditions...\n\n";
    
    // Condition 1: Basket 53
    $stmt = $pdo->query("SELECT COUNT(*) as cnt FROM customers WHERE current_basket_key = 53");
    $cnt = $stmt->fetch()['cnt'];
    echo "   Customers in basket 53: $cnt\n";
    
    // Condition 2: No owner
    $stmt = $pdo->query("SELECT COUNT(*) as cnt FROM customers WHERE current_basket_key = 53 AND (assigned_to IS NULL OR assigned_to = 0)");
    $cnt = $stmt->fetch()['cnt'];
    echo "   Customers in basket 53 with no owner: $cnt\n";
    
    // Condition 3: Has orders
    $stmt = $pdo->query("
        SELECT COUNT(DISTINCT c.customer_id) as cnt 
        FROM customers c
        INNER JOIN orders o ON (o.customer_id = c.customer_id OR o.customer_id = c.customer_ref_id)
        WHERE c.current_basket_key = 53 AND (c.assigned_to IS NULL OR c.assigned_to = 0)
    ");
    $cnt = $stmt->fetch()['cnt'];
    echo "   Customers in basket 53 with no owner AND has orders: $cnt\n";
    
    // Condition 4: Orders in last 7 days
    $stmt = $pdo->query("
        SELECT COUNT(DISTINCT c.customer_id) as cnt 
        FROM customers c
        INNER JOIN orders o ON (o.customer_id = c.customer_id OR o.customer_id = c.customer_ref_id)
        WHERE c.current_basket_key = 53 
          AND (c.assigned_to IS NULL OR c.assigned_to = 0)
          AND o.order_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)
    ");
    $cnt = $stmt->fetch()['cnt'];
    echo "   + orders in last 7 days: $cnt\n";
    
    // Condition 5: Picking status
    $stmt = $pdo->query("
        SELECT COUNT(DISTINCT c.customer_id) as cnt 
        FROM customers c
        INNER JOIN orders o ON (o.customer_id = c.customer_id OR o.customer_id = c.customer_ref_id)
        WHERE c.current_basket_key = 53 
          AND (c.assigned_to IS NULL OR c.assigned_to = 0)
          AND o.order_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)
          AND o.order_status = 'Picking'
    ");
    $cnt = $stmt->fetch()['cnt'];
    echo "   + order status = Picking: $cnt\n";
    
    // Condition 6: Creator role
    $stmt = $pdo->query("
        SELECT COUNT(DISTINCT c.customer_id) as cnt 
        FROM customers c
        INNER JOIN orders o ON (o.customer_id = c.customer_id OR o.customer_id = c.customer_ref_id)
        INNER JOIN users u ON o.creator_id = u.id
        WHERE c.current_basket_key = 53 
          AND (c.assigned_to IS NULL OR c.assigned_to = 0)
          AND o.order_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)
          AND o.order_status = 'Picking'
          AND u.role_id NOT IN (6, 7)
    ");
    $cnt = $stmt->fetch()['cnt'];
    echo "   + creator NOT Telesale (role 6,7): $cnt\n";
}

echo "\n=== DEBUG COMPLETE ===\n";
