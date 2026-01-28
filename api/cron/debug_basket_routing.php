<?php
/**
 * Debug Script: Analyze why customers in basket 38 should be in 39
 * 
 * This script examines customers that fix_basket_38_to_39 found
 * to understand why process_picking_baskets didn't move them
 */

error_reporting(E_ALL);
ini_set('display_errors', 1);

header('Content-Type: text/plain; charset=utf-8');

// Security check
$expectedKey = 'debug_basket_2026_secret';
$providedKey = $_GET['key'] ?? '';

if ($providedKey !== $expectedKey) {
    http_response_code(403);
    die("Access denied. Invalid key.");
}

require_once __DIR__ . '/../config.php';

echo "=====================================================\n";
echo "Debug: Basket 38 → 39 Routing Analysis\n";
echo "Date: " . date('Y-m-d H:i:s') . "\n";
echo "=====================================================\n\n";

try {
    $pdo = db_connect();
    
    // Get a sample of customers from fix script (basket 38 with Telesale involvement)
    $sql = "
        SELECT DISTINCT
            c.customer_id,
            c.first_name,
            c.last_name,
            c.phone,
            c.current_basket_key,
            c.assigned_to,
            c.basket_entered_date,
            c.ownership_expires
        FROM customers c
        INNER JOIN orders o ON c.customer_id = o.customer_id
        INNER JOIN users u ON o.creator_id = u.id
        WHERE c.current_basket_key = 38
          AND c.assigned_to IS NOT NULL AND c.assigned_to > 0
          AND u.role_id IN (6, 7)
          AND o.order_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        ORDER BY c.customer_id
        LIMIT 10
    ";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    $customers = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "Found " . count($customers) . " customers in basket 38 with Telesale involvement\n\n";
    
    foreach ($customers as $index => $customer) {
        $num = $index + 1;
        $customerId = $customer['customer_id'];
        $name = trim($customer['first_name'] . ' ' . $customer['last_name']);
        
        echo "=====================================================\n";
        echo "[{$num}] Customer ID: {$customerId} ({$name})\n";
        echo "=====================================================\n";
        echo "  Phone: {$customer['phone']}\n";
        echo "  Current Basket: {$customer['current_basket_key']}\n";
        echo "  Assigned To: {$customer['assigned_to']}\n";
        echo "  Basket Entered: {$customer['basket_entered_date']}\n";
        echo "  Ownership Expires: {$customer['ownership_expires']}\n\n";
        
        // Get assigned user info
        $userStmt = $pdo->prepare("SELECT id, username, role_id FROM users WHERE id = ?");
        $userStmt->execute([$customer['assigned_to']]);
        $assignedUser = $userStmt->fetch(PDO::FETCH_ASSOC);
        
        if ($assignedUser) {
            echo "  Assigned User: ID={$assignedUser['id']}, Username={$assignedUser['username']}, Role={$assignedUser['role_id']}\n\n";
        }
        
        // Get ALL orders for this customer (last 14 days)
        $ordersStmt = $pdo->prepare("
            SELECT 
                o.id as order_id,
                o.order_status,
                o.order_date,
                o.creator_id,
                u.username as creator_username,
                u.role_id as creator_role
            FROM orders o
            LEFT JOIN users u ON o.creator_id = u.id
            WHERE o.customer_id = ?
              AND o.order_date >= DATE_SUB(NOW(), INTERVAL 14 DAY)
            ORDER BY o.order_date DESC
        ");
        $ordersStmt->execute([$customerId]);
        $orders = $ordersStmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo "  === ORDERS (Last 14 days) ===\n";
        if (empty($orders)) {
            echo "  No orders found!\n";
        } else {
            foreach ($orders as $order) {
                $isTelesale = in_array($order['creator_role'], [6, 7]) ? 'YES' : 'NO';
                $isOwner = ($order['creator_id'] == $customer['assigned_to']) ? 'YES' : 'NO';
                
                echo "  Order: {$order['order_id']}\n";
                echo "    Status: {$order['order_status']}\n";
                echo "    Date: {$order['order_date']}\n";
                echo "    Creator: ID={$order['creator_id']}, Username={$order['creator_username']}, Role={$order['creator_role']}\n";
                echo "    Is Telesale? {$isTelesale}\n";
                echo "    Is Owner (creator = assigned_to)? {$isOwner}\n";
                
                // Check if this should trigger move to 39
                if ($isTelesale === 'YES' && $isOwner === 'YES' && in_array($order['order_status'], ['Picking', 'Shipping'])) {
                    echo "    >>> SHOULD HAVE MOVED TO BASKET 39! <<<\n";
                }
                echo "\n";
            }
        }
        
        // Check basket transition log for this customer
        $logStmt = $pdo->prepare("
            SELECT *
            FROM basket_transition_log
            WHERE customer_id = ?
            ORDER BY created_at DESC
            LIMIT 10
        ");
        $logStmt->execute([$customerId]);
        $logs = $logStmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo "  === BASKET TRANSITION LOG (Last 10) ===\n";
        if (empty($logs)) {
            echo "  No transition logs found!\n";
        } else {
            foreach ($logs as $log) {
                $fromBasket = $log['from_basket_key'] ?? $log['from_basket'] ?? 'N/A';
                $toBasket = $log['to_basket_key'] ?? $log['to_basket'] ?? 'N/A';
                $reason = $log['transition_type'] ?? $log['reason'] ?? 'N/A';
                $createdAt = $log['created_at'] ?? 'N/A';
                
                echo "  [{$createdAt}] {$fromBasket} → {$toBasket} (Reason: {$reason})\n";
            }
        }
        
        echo "\n";
    }
    
    // Summary analysis
    echo "=====================================================\n";
    echo "ANALYSIS SUMMARY\n";
    echo "=====================================================\n";
    
    // Check process_picking_baskets logic
    echo "\nChecking process_picking_baskets.php would catch:\n";
    $pickingStmt = $pdo->prepare("
        SELECT DISTINCT 
            o.id as order_id,
            o.customer_id,
            o.creator_id,
            c.customer_id as customer_pk,
            c.assigned_to,
            c.current_basket_key,
            u.role_id as creator_role_id
        FROM orders o
        INNER JOIN customers c ON (c.customer_ref_id = o.customer_id OR c.customer_id = o.customer_id)
        LEFT JOIN users u ON u.id = o.creator_id
        WHERE o.order_status = 'Picking'
          AND o.order_date >= DATE_SUB(NOW(), INTERVAL 30 MINUTE)
        LIMIT 20
    ");
    $pickingStmt->execute();
    $pickingOrders = $pickingStmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "Orders with status='Picking' in last 30 min: " . count($pickingOrders) . "\n";
    
    foreach ($pickingOrders as $po) {
        $isTelesale = in_array($po['creator_role_id'], [6, 7]);
        $isOwner = ($po['assigned_to'] > 0 && $po['assigned_to'] == $po['creator_id']);
        echo "  Order: {$po['order_id']}, Customer: {$po['customer_pk']}, Basket: {$po['current_basket_key']}, ";
        echo "IsTelesale: " . ($isTelesale ? 'Y' : 'N') . ", IsOwner: " . ($isOwner ? 'Y' : 'N') . "\n";
    }
    
    echo "\n";
    
} catch (PDOException $e) {
    echo "Database error: " . $e->getMessage() . "\n";
    exit(1);
}
