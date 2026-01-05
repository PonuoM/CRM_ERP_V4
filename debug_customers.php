<?php
// Debug script to check customers for user ID 1655
require_once 'api/config.php';

cors();

try {
    $pdo = db_connect();
    
    $userId = 1655;
    
    echo "=== Debug Customers for User ID: {$userId} ===\n\n";
    
    // 1. Check if user exists
    echo "1. Checking if user exists...\n";
    $stmt = $pdo->prepare("SELECT id, username, role, company_id, status FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    $user = $stmt->fetch();
    
    if ($user) {
        echo "   ✓ User found:\n";
        echo "     - Username: {$user['username']}\n";
        echo "     - Role: {$user['role']}\n";
        echo "     - Company ID: {$user['company_id']}\n";
        echo "     - Status: {$user['status']}\n\n";
    } else {
        echo "   ✗ User NOT found!\n\n";
        exit;
    }
    
    // 2. Check customers assigned to this user
    echo "2. Checking customers assigned to user {$userId}...\n";
    $stmt = $pdo->prepare("
        SELECT 
            customer_id,
            customer_ref_id,
            first_name,
            last_name,
            phone,
            assigned_to,
            company_id,
            lifecycle_status,
            date_assigned,
            date_registered
        FROM customers 
        WHERE assigned_to = ?
        ORDER BY date_assigned DESC
        LIMIT 10
    ");
    $stmt->execute([$userId]);
    $customers = $stmt->fetchAll();
    
    echo "   Found " . count($customers) . " customers assigned to user {$userId}\n\n";
    
    if (count($customers) > 0) {
        echo "   Sample customers:\n";
        foreach ($customers as $i => $c) {
            echo "   " . ($i + 1) . ". ID: {$c['customer_id']}, Name: {$c['first_name']} {$c['last_name']}, Phone: {$c['phone']}\n";
            echo "      Status: {$c['lifecycle_status']}, Assigned: {$c['date_assigned']}\n";
        }
    } else {
        echo "   ✗ NO customers assigned to this user!\n";
    }
    echo "\n";
    
    // 3. Check total customers in same company
    echo "3. Checking total customers in company {$user['company_id']}...\n";
    $stmt = $pdo->prepare("
        SELECT COUNT(*) as total
        FROM customers 
        WHERE company_id = ?
    ");
    $stmt->execute([$user['company_id']]);
    $result = $stmt->fetch();
    echo "   Total customers in company: {$result['total']}\n\n";
    
    // 4. Check API endpoint simulation
    echo "4. Simulating API call listCustomers with assignedTo={$userId}...\n";
    $companyId = $user['company_id'];
    $stmt = $pdo->prepare("
        SELECT 
            c.customer_id,
            c.customer_ref_id,
            c.first_name,
            c.last_name,
            c.phone,
            c.email,
            c.province,
            c.company_id,
            c.assigned_to,
            c.date_assigned,
            c.date_registered,
            c.follow_up_date,
            c.ownership_expires,
            c.lifecycle_status,
            c.behavioral_status,
            c.facebook_name,
            c.line_id,
            COALESCE(SUM(o.total_amount), 0) as total_purchases,
            COUNT(DISTINCT ch.id) as total_calls
        FROM customers c
        LEFT JOIN orders o ON c.customer_id = o.customer_id AND o.order_status != 'Cancelled'
        LEFT JOIN call_history ch ON c.customer_id = ch.customer_id
        WHERE c.company_id = ? AND c.assigned_to = ?
        GROUP BY c.customer_id
        LIMIT 10
    ");
    $stmt->execute([$companyId, $userId]);
    $apiResult = $stmt->fetchAll();
    
    echo "   API would return " . count($apiResult) . " customers\n\n";
    
    if (count($apiResult) > 0) {
        echo "   Sample API results:\n";
        foreach ($apiResult as $i => $c) {
            echo "   " . ($i + 1) . ". ID: {$c['customer_id']}, Name: {$c['first_name']} {$c['last_name']}\n";
            echo "      Phone: {$c['phone']}, Status: {$c['lifecycle_status']}\n";
            echo "      Purchases: {$c['total_purchases']}, Calls: {$c['total_calls']}\n";
        }
    }
    
    echo "\n=== Debug Complete ===\n";
    
} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
    echo "Trace: " . $e->getTraceAsString() . "\n";
}
