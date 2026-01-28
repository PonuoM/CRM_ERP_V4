<?php
/**
 * Debug Script: Today's Orders Analysis
 * 
 * วิเคราะห์ Order ทั้งหมดที่เกิดขึ้นวันนี้
 * - ใครสร้าง (Admin/Telesale/Other)
 * - ลูกค้าถูกส่งไปไหน
 * - อะไรผิดพลาด อะไรถูกต้อง
 */

error_reporting(E_ALL);
ini_set('display_errors', 1);

header('Content-Type: text/plain; charset=utf-8');

// Security check
$expectedKey = 'debug_orders_2026_secret';
$providedKey = $_GET['key'] ?? '';

if ($providedKey !== $expectedKey) {
    http_response_code(403);
    die("Access denied. Invalid key.");
}

require_once __DIR__ . '/../config.php';

$today = date('Y-m-d');

echo "=====================================================\n";
echo "Debug: Today's Orders Analysis\n";
echo "Date: {$today} " . date('H:i:s') . "\n";
echo "=====================================================\n\n";

try {
    $pdo = db_connect();
    
    // === SECTION 1: Orders Summary Today ===
    echo "=== SECTION 1: ORDERS SUMMARY TODAY ===\n\n";
    
    $ordersSummaryStmt = $pdo->prepare("
        SELECT 
            u.role_id,
            CASE 
                WHEN u.role_id IN (6, 7) THEN 'Telesale'
                WHEN u.role_id IN (1, 2, 3) THEN 'Admin/Staff'
                ELSE 'Other'
            END as creator_type,
            COUNT(*) as order_count,
            o.order_status
        FROM orders o
        LEFT JOIN users u ON o.creator_id = u.id
        WHERE DATE(o.order_date) = ?
        GROUP BY u.role_id, o.order_status
        ORDER BY creator_type, order_status
    ");
    $ordersSummaryStmt->execute([$today]);
    $ordersSummary = $ordersSummaryStmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "Orders by Creator Type and Status:\n";
    echo str_pad("Creator Type", 15) . str_pad("Role ID", 10) . str_pad("Status", 15) . "Count\n";
    echo str_repeat("-", 50) . "\n";
    foreach ($ordersSummary as $row) {
        echo str_pad($row['creator_type'], 15) . str_pad($row['role_id'] ?? 'N/A', 10) . str_pad($row['order_status'], 15) . $row['order_count'] . "\n";
    }
    
    // Total by creator type
    $totalByCreatorStmt = $pdo->prepare("
        SELECT 
            CASE 
                WHEN u.role_id IN (6, 7) THEN 'Telesale'
                WHEN u.role_id IN (1, 2, 3) THEN 'Admin/Staff'
                ELSE 'Other'
            END as creator_type,
            COUNT(*) as total
        FROM orders o
        LEFT JOIN users u ON o.creator_id = u.id
        WHERE DATE(o.order_date) = ?
        GROUP BY creator_type
    ");
    $totalByCreatorStmt->execute([$today]);
    $totalByCreator = $totalByCreatorStmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "\nTotal Orders by Creator Type:\n";
    foreach ($totalByCreator as $row) {
        echo "  {$row['creator_type']}: {$row['total']}\n";
    }
    
    // === SECTION 2: Manual Transitions Today ===
    echo "\n\n=== SECTION 2: BASKET TRANSITIONS WITH REASON 'manual' TODAY ===\n\n";
    
    // Check different column names
    $manualTransStmt = $pdo->prepare("
        SELECT 
            btl.*,
            c.first_name,
            c.last_name,
            c.phone,
            c.assigned_to
        FROM basket_transition_log btl
        LEFT JOIN customers c ON btl.customer_id = c.customer_id
        WHERE DATE(btl.created_at) = ?
          AND (btl.transition_type = 'manual' OR btl.reason = 'manual' OR btl.notes LIKE '%manual%')
        ORDER BY btl.created_at DESC
        LIMIT 50
    ");
    $manualTransStmt->execute([$today]);
    $manualTrans = $manualTransStmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "Found " . count($manualTrans) . " 'manual' transitions today:\n\n";
    
    // Group by time to see patterns
    $timeGroups = [];
    foreach ($manualTrans as $trans) {
        $time = substr($trans['created_at'], 11, 5); // HH:MM
        if (!isset($timeGroups[$time])) {
            $timeGroups[$time] = 0;
        }
        $timeGroups[$time]++;
    }
    
    echo "Manual Transitions by Time (Top 10):\n";
    arsort($timeGroups);
    $count = 0;
    foreach ($timeGroups as $time => $cnt) {
        echo "  {$time} - {$cnt} transitions\n";
        if (++$count >= 10) break;
    }
    
    // Look for triggered_by
    echo "\n\nSample 'manual' transitions (first 10):\n";
    foreach (array_slice($manualTrans, 0, 10) as $trans) {
        $fromBasket = $trans['from_basket_key'] ?? $trans['from_basket'] ?? 'N/A';
        $toBasket = $trans['to_basket_key'] ?? $trans['to_basket'] ?? 'N/A';
        $triggeredBy = $trans['triggered_by'] ?? 'N/A';
        $notes = $trans['notes'] ?? 'N/A';
        $reason = $trans['transition_type'] ?? $trans['reason'] ?? 'N/A';
        
        echo "  Customer: {$trans['customer_id']} ({$trans['first_name']} {$trans['last_name']})\n";
        echo "    Time: {$trans['created_at']}\n";
        echo "    From: {$fromBasket} → To: {$toBasket}\n";
        echo "    Triggered By: {$triggeredBy}\n";
        echo "    Reason: {$reason}\n";
        echo "    Notes: {$notes}\n\n";
    }
    
    // === SECTION 3: All Transitions at 11:21 ===
    echo "\n=== SECTION 3: TRANSITIONS AROUND 11:21 ===\n\n";
    
    $elevenTwentyStmt = $pdo->prepare("
        SELECT 
            btl.*,
            c.first_name,
            c.last_name,
            c.assigned_to
        FROM basket_transition_log btl
        LEFT JOIN customers c ON btl.customer_id = c.customer_id
        WHERE DATE(btl.created_at) = ?
          AND TIME(btl.created_at) BETWEEN '11:20:00' AND '11:25:00'
        ORDER BY btl.created_at
    ");
    $elevenTwentyStmt->execute([$today]);
    $elevenTwenty = $elevenTwentyStmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "Found " . count($elevenTwenty) . " transitions between 11:20-11:25:\n\n";
    
    // Group by from/to basket
    $routeGroups = [];
    foreach ($elevenTwenty as $trans) {
        $fromBasket = $trans['from_basket_key'] ?? $trans['from_basket'] ?? 'N/A';
        $toBasket = $trans['to_basket_key'] ?? $trans['to_basket'] ?? 'N/A';
        $route = "{$fromBasket} → {$toBasket}";
        if (!isset($routeGroups[$route])) {
            $routeGroups[$route] = 0;
        }
        $routeGroups[$route]++;
    }
    
    echo "Routes at 11:21:\n";
    arsort($routeGroups);
    foreach ($routeGroups as $route => $cnt) {
        echo "  {$route}: {$cnt} customers\n";
    }
    
    // === SECTION 4: Admin-Created Orders Today ===
    echo "\n\n=== SECTION 4: ADMIN-CREATED ORDERS TODAY ===\n\n";
    
    $adminOrdersStmt = $pdo->prepare("
        SELECT 
            o.id as order_id,
            o.customer_id,
            o.order_status,
            o.order_date,
            o.creator_id,
            u.username as creator_username,
            u.role_id as creator_role,
            c.first_name,
            c.last_name,
            c.current_basket_key,
            c.assigned_to
        FROM orders o
        LEFT JOIN users u ON o.creator_id = u.id
        LEFT JOIN customers c ON o.customer_id = c.customer_id
        WHERE DATE(o.order_date) = ?
          AND u.role_id IN (1, 2, 3)
        ORDER BY o.order_date DESC
        LIMIT 30
    ");
    $adminOrdersStmt->execute([$today]);
    $adminOrders = $adminOrdersStmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "Found " . count($adminOrders) . " admin-created orders today:\n\n";
    
    // Check if they're in correct baskets
    $correct = 0;
    $incorrect = 0;
    
    foreach ($adminOrders as $order) {
        $hasAssignedTo = $order['assigned_to'] > 0;
        $currentBasket = $order['current_basket_key'];
        $status = $order['order_status'];
        
        // If order is Picking/Shipping and created by Admin, customer should be in upsell flow
        $shouldBeIn = null;
        $isCorrect = null;
        
        if ($hasAssignedTo) {
            // Has owner - should be in 51 (upsell) or 39 (if Telesale sold)
            if (in_array($status, ['Pending'])) {
                $shouldBeIn = '51 (Upsell Dashboard)';
                $isCorrect = ($currentBasket == 51);
            } else {
                // Picking/Shipping by Admin should still be in upsell
                $shouldBeIn = '51 or 39';
                $isCorrect = in_array($currentBasket, [51, 39]);
            }
        } else {
            // No owner - should be in 53 (upsell distribution) or 38/52
            if ($status == 'Pending') {
                $shouldBeIn = '53 (Upsell Distribution)';
                $isCorrect = ($currentBasket == 53);
            } else {
                $shouldBeIn = '38 or 52';
                $isCorrect = in_array($currentBasket, [38, 52]);
            }
        }
        
        if ($isCorrect) {
            $correct++;
        } else {
            $incorrect++;
        }
        
        $status = $isCorrect ? "✓" : "✗";
        echo "[{$status}] Order: {$order['order_id']}\n";
        echo "    Customer: {$order['customer_id']} ({$order['first_name']} {$order['last_name']})\n";
        echo "    Status: {$order['order_status']}\n";
        echo "    Creator: {$order['creator_username']} (Role: {$order['creator_role']})\n";
        echo "    Assigned To: " . ($order['assigned_to'] ?: 'None') . "\n";
        echo "    Current Basket: {$currentBasket}\n";
        echo "    Should Be: {$shouldBeIn}\n\n";
    }
    
    echo "Summary: {$correct} correct, {$incorrect} potentially incorrect\n";
    
    // === SECTION 5: Find what code triggers 'manual' ===
    echo "\n\n=== SECTION 5: SEARCHING FOR 'manual' SOURCE ===\n\n";
    echo "The 'manual' reason likely comes from:\n";
    echo "1. API endpoint that updates customer basket\n";
    echo "2. Bulk operations in Manage Orders page\n";
    echo "3. Distribution/Reclaim operations\n\n";
    
    echo "Check these files:\n";
    echo "- api/index.php (customer update endpoint)\n";
    echo "- api/basket_config.php (bulk assign/reclaim)\n";
    echo "- Any code that sets transition_type = 'manual'\n";
    
} catch (PDOException $e) {
    echo "Database error: " . $e->getMessage() . "\n";
    exit(1);
}
