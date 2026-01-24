<?php
/**
 * Debug Script: ตรวจสอบ Basket Transition
 * URL: /api/cron/debug_basket_transition.php?customer_id=302976&user_id=1655
 */

require_once __DIR__ . '/../config.php';

header('Content-Type: text/html; charset=utf-8');

// Get parameters
$customerId = $_GET['customer_id'] ?? null;
$userId = $_GET['user_id'] ?? null;

if (!$customerId || !$userId) {
    echo "<h1>❌ กรุณาระบุ customer_id และ user_id</h1>";
    echo "<p>ตัวอย่าง: ?customer_id=302976&user_id=1655</p>";
    exit;
}

try {
    $pdo = db_connect();
    
    echo "<html><head><meta charset='utf-8'><title>Debug Basket Transition</title>";
    echo "<style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        .success { color: green; font-weight: bold; }
        .error { color: red; font-weight: bold; }
        .warning { color: orange; font-weight: bold; }
        table { border-collapse: collapse; margin: 10px 0; }
        th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
        th { background: #f5f5f5; }
        .section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 8px; }
        h2 { margin-top: 0; color: #333; }
    </style></head><body>";
    
    echo "<h1>🔍 Debug Basket Transition</h1>";
    echo "<p>เวลาตรวจสอบ: " . date('Y-m-d H:i:s') . "</p>";
    
    // ========== 1. ตรวจสอบ User ==========
    echo "<div class='section'>";
    echo "<h2>1. ข้อมูล User (ID: {$userId})</h2>";
    
    $userStmt = $pdo->prepare("SELECT id, username, first_name, last_name, role, role_id, status FROM users WHERE id = ?");
    $userStmt->execute([$userId]);
    $user = $userStmt->fetch(PDO::FETCH_ASSOC);
    
    if ($user) {
        echo "<table>";
        echo "<tr><th>ID</th><td>{$user['id']}</td></tr>";
        echo "<tr><th>Username</th><td>{$user['username']}</td></tr>";
        echo "<tr><th>ชื่อ</th><td>{$user['first_name']} {$user['last_name']}</td></tr>";
        echo "<tr><th>Role (string)</th><td>{$user['role']}</td></tr>";
        echo "<tr><th>Role ID</th><td>";
        
        if ($user['role_id'] === null) {
            echo "<span class='error'>NULL - ยังไม่ได้ Populate!</span>";
        } elseif ($user['role_id'] == 6 || $user['role_id'] == 7) {
            echo "<span class='success'>{$user['role_id']} ✅ (Telesale/Supervisor)</span>";
        } else {
            echo "<span class='warning'>{$user['role_id']} - ไม่ใช่ Telesale/Supervisor</span>";
        }
        echo "</td></tr>";
        echo "<tr><th>Status</th><td>{$user['status']}</td></tr>";
        echo "</table>";
        
        // Check condition
        $isTelesaleOrSupervisor = ($user['role_id'] == 6 || $user['role_id'] == 7);
        echo "<p><strong>เงื่อนไข #1:</strong> User เป็น Telesale (7) หรือ Supervisor (6)? ";
        echo $isTelesaleOrSupervisor ? "<span class='success'>✅ ผ่าน</span>" : "<span class='error'>❌ ไม่ผ่าน</span>";
        echo "</p>";
    } else {
        echo "<p class='error'>❌ ไม่พบ User ID: {$userId}</p>";
    }
    echo "</div>";
    
    // ========== 2. ตรวจสอบ Customer ==========
    echo "<div class='section'>";
    echo "<h2>2. ข้อมูลลูกค้า (ID: {$customerId})</h2>";
    
    $custStmt = $pdo->prepare("SELECT customer_id, customer_ref_id, first_name, last_name, assigned_to, current_basket_key FROM customers WHERE customer_id = ?");
    $custStmt->execute([$customerId]);
    $customer = $custStmt->fetch(PDO::FETCH_ASSOC);
    
    if ($customer) {
        echo "<table>";
        echo "<tr><th>Customer ID (PK)</th><td>{$customer['customer_id']}</td></tr>";
        echo "<tr><th>Customer Ref ID</th><td>{$customer['customer_ref_id']}</td></tr>";
        echo "<tr><th>ชื่อ</th><td>{$customer['first_name']} {$customer['last_name']}</td></tr>";
        echo "<tr><th>Assigned To</th><td>";
        
        if ($customer['assigned_to'] === null) {
            echo "<span class='warning'>NULL - ไม่มีเจ้าของ</span>";
        } elseif ($customer['assigned_to'] == $userId) {
            echo "<span class='success'>{$customer['assigned_to']} ✅ (ตรงกับ User ที่ตรวจสอบ)</span>";
        } else {
            echo "<span class='error'>{$customer['assigned_to']} - ไม่ตรงกับ User {$userId}</span>";
        }
        echo "</td></tr>";
        echo "<tr><th>Current Basket Key</th><td>{$customer['current_basket_key']}</td></tr>";
        echo "</table>";
        
        // Check condition
        $isOwner = ($customer['assigned_to'] == $userId);
        echo "<p><strong>เงื่อนไข #2:</strong> User เป็นเจ้าของลูกค้า (assigned_to = user_id)? ";
        echo $isOwner ? "<span class='success'>✅ ผ่าน</span>" : "<span class='error'>❌ ไม่ผ่าน</span>";
        echo "</p>";
    } else {
        echo "<p class='error'>❌ ไม่พบ Customer ID: {$customerId}</p>";
    }
    echo "</div>";
    
    // ========== 3. ตรวจสอบ Order ล่าสุด ==========
    echo "<div class='section'>";
    echo "<h2>3. Order ล่าสุดของลูกค้า</h2>";
    
    // Get customer_ref_id for order lookup
    $custRefId = $customer['customer_ref_id'] ?? null;
    
    $orderStmt = $pdo->prepare("
        SELECT o.id, o.order_date, o.order_status, o.creator_id, u.username as creator_name, u.role_id as creator_role_id
        FROM orders o
        LEFT JOIN users u ON o.creator_id = u.id
        WHERE o.customer_id = ? OR o.customer_id = ?
        ORDER BY o.order_date DESC
        LIMIT 5
    ");
    $orderStmt->execute([$customerId, $custRefId]);
    $orders = $orderStmt->fetchAll(PDO::FETCH_ASSOC);
    
    if ($orders) {
        echo "<table>";
        echo "<tr><th>Order ID</th><th>วันที่</th><th>สถานะ</th><th>Creator ID</th><th>Creator Name</th><th>Creator Role ID</th></tr>";
        foreach ($orders as $order) {
            $statusClass = ($order['order_status'] === 'Picking') ? 'success' : '';
            echo "<tr>";
            echo "<td>{$order['id']}</td>";
            echo "<td>{$order['order_date']}</td>";
            echo "<td class='{$statusClass}'>{$order['order_status']}</td>";
            echo "<td>{$order['creator_id']}</td>";
            echo "<td>{$order['creator_name']}</td>";
            echo "<td>{$order['creator_role_id']}</td>";
            echo "</tr>";
        }
        echo "</table>";
        
        // Check latest order
        $latestOrder = $orders[0];
        echo "<h3>Order ล่าสุด: {$latestOrder['id']}</h3>";
        
        $isPicking = ($latestOrder['order_status'] === 'Picking');
        echo "<p><strong>เงื่อนไข #3:</strong> สถานะ Order เป็น Picking? ";
        echo $isPicking ? "<span class='success'>✅ ผ่าน</span>" : "<span class='error'>❌ ไม่ผ่าน (สถานะ: {$latestOrder['order_status']})</span>";
        echo "</p>";
        
        $creatorIsOwner = ($latestOrder['creator_id'] == $userId);
        echo "<p><strong>เงื่อนไข #4:</strong> Creator ของ Order เป็น User ที่ตรวจสอบ? ";
        echo $creatorIsOwner ? "<span class='success'>✅ ผ่าน</span>" : "<span class='error'>❌ ไม่ผ่าน</span>";
        echo "</p>";
        
        $creatorIsTelesale = ($latestOrder['creator_role_id'] == 6 || $latestOrder['creator_role_id'] == 7);
        echo "<p><strong>เงื่อนไข #5:</strong> Creator Role ID เป็น 6 หรือ 7? ";
        echo $creatorIsTelesale ? "<span class='success'>✅ ผ่าน</span>" : "<span class='error'>❌ ไม่ผ่าน (role_id: {$latestOrder['creator_role_id']})</span>";
        echo "</p>";
    } else {
        echo "<p class='warning'>⚠️ ไม่พบ Order สำหรับลูกค้านี้</p>";
    }
    echo "</div>";
    
    // ========== 4. สรุปผล ==========
    echo "<div class='section'>";
    echo "<h2>4. สรุปผล</h2>";
    
    $allConditionsMet = false;
    if (isset($user) && isset($customer) && isset($latestOrder)) {
        $cond1 = ($user['role_id'] == 6 || $user['role_id'] == 7);
        $cond2 = ($customer['assigned_to'] == $userId);
        $cond3 = ($latestOrder['order_status'] === 'Picking');
        $cond4 = ($latestOrder['creator_id'] == $userId);
        $cond5 = ($latestOrder['creator_role_id'] == 6 || $latestOrder['creator_role_id'] == 7);
        
        $allConditionsMet = $cond1 && $cond2 && $cond3 && $cond4 && $cond5;
        
        echo "<table>";
        echo "<tr><th>เงื่อนไข</th><th>ผลลัพธ์</th></tr>";
        echo "<tr><td>1. User เป็น Telesale/Supervisor</td><td>" . ($cond1 ? "✅" : "❌") . "</td></tr>";
        echo "<tr><td>2. User เป็นเจ้าของลูกค้า</td><td>" . ($cond2 ? "✅" : "❌") . "</td></tr>";
        echo "<tr><td>3. Order สถานะ Picking</td><td>" . ($cond3 ? "✅" : "❌") . "</td></tr>";
        echo "<tr><td>4. Creator ตรงกับ User</td><td>" . ($cond4 ? "✅" : "❌") . "</td></tr>";
        echo "<tr><td>5. Creator Role ID เป็น 6 หรือ 7</td><td>" . ($cond5 ? "✅" : "❌") . "</td></tr>";
        echo "</table>";
    }
    
    if ($allConditionsMet) {
        echo "<p class='success' style='font-size: 18px;'>✅ ทุกเงื่อนไขผ่าน - ลูกค้าควรถูกย้ายไป Basket 39</p>";
        echo "<p>ถ้ายังไม่ย้าย แสดงว่า:</p>";
        echo "<ul>";
        echo "<li>ไฟล์ <code>api/index.php</code> ใหม่ยังไม่ได้อัปโหลดไป Production</li>";
        echo "<li>หรือ Export ไม่ได้ใช้ PATCH API (อาจใช้ SQL ตรง)</li>";
        echo "</ul>";
    } else {
        echo "<p class='error' style='font-size: 18px;'>❌ มีเงื่อนไขที่ไม่ผ่าน - ลูกค้าจะไม่ถูกย้ายถัง</p>";
    }
    echo "</div>";
    
    // ========== 5. Error Logs ==========
    echo "<div class='section'>";
    echo "<h2>5. PHP Error Log (ล่าสุด 20 บรรทัด)</h2>";
    $errorLogPath = ini_get('error_log');
    if ($errorLogPath && file_exists($errorLogPath)) {
        $lines = file($errorLogPath);
        $lastLines = array_slice($lines, -20);
        echo "<pre style='background: #f5f5f5; padding: 10px; overflow: auto; max-height: 300px;'>";
        foreach ($lastLines as $line) {
            if (stripos($line, 'basket') !== false) {
                echo "<span style='background: yellow;'>" . htmlspecialchars($line) . "</span>";
            } else {
                echo htmlspecialchars($line);
            }
        }
        echo "</pre>";
    } else {
        echo "<p class='warning'>ไม่สามารถอ่าน Error Log ได้</p>";
    }
    echo "</div>";
    
    echo "</body></html>";
    
} catch (Exception $e) {
    echo "<h1 class='error'>Error: " . htmlspecialchars($e->getMessage()) . "</h1>";
}
?>
