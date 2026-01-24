<?php
/**
 * Manual Basket Transition Test
 * URL: /api/cron/test_basket_move.php?customer_id=302976&order_id=260124-00028telesale1rr
 */

require_once __DIR__ . '/../config.php';

header('Content-Type: text/html; charset=utf-8');

$customerId = $_GET['customer_id'] ?? null;
$orderId = $_GET['order_id'] ?? null;
$doMove = isset($_GET['do_move']) && $_GET['do_move'] === '1';

if (!$customerId || !$orderId) {
    echo "<h1>❌ กรุณาระบุ customer_id และ order_id</h1>";
    echo "<p>ตัวอย่าง: ?customer_id=302976&order_id=260124-00028telesale1rr</p>";
    exit;
}

try {
    $pdo = db_connect();
    
    echo "<html><head><meta charset='utf-8'><title>Test Basket Move</title>";
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
        .btn { display: inline-block; padding: 10px 20px; background: #4CAF50; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
        .btn:hover { background: #45a049; }
    </style></head><body>";
    
    echo "<h1>🧪 Test Basket Move</h1>";
    echo "<p>เวลาทดสอบ: " . date('Y-m-d H:i:s') . "</p>";
    
    // ========== 1. ดึงข้อมูล Order ==========
    echo "<div class='section'>";
    echo "<h2>1. ข้อมูล Order</h2>";
    
    $orderStmt = $pdo->prepare("SELECT * FROM orders WHERE id = ?");
    $orderStmt->execute([$orderId]);
    $order = $orderStmt->fetch(PDO::FETCH_ASSOC);
    
    if ($order) {
        echo "<table>";
        echo "<tr><th>Order ID</th><td>{$order['id']}</td></tr>";
        echo "<tr><th>Customer ID (in order)</th><td><strong>{$order['customer_id']}</strong></td></tr>";
        echo "<tr><th>Creator ID</th><td><strong>{$order['creator_id']}</strong></td></tr>";
        echo "<tr><th>Order Status</th><td>{$order['order_status']}</td></tr>";
        echo "<tr><th>Order Date</th><td>{$order['order_date']}</td></tr>";
        echo "<tr><th>Delivery Date</th><td>" . ($order['delivery_date'] ?? 'NULL') . "</td></tr>";
        echo "</table>";
        
        $orderCustomerId = $order['customer_id'];
        $creatorId = $order['creator_id'];
    } else {
        echo "<p class='error'>❌ ไม่พบ Order: {$orderId}</p>";
        exit;
    }
    echo "</div>";
    
    // ========== 2. หา Customer ==========
    echo "<div class='section'>";
    echo "<h2>2. หา Customer จาก Order</h2>";
    
    echo "<p>Order.customer_id = <strong>{$orderCustomerId}</strong></p>";
    echo "<p>กำลังค้นหา: WHERE customer_ref_id = '{$orderCustomerId}' OR customer_id = " . (is_numeric($orderCustomerId) ? (int)$orderCustomerId : "NULL") . "</p>";
    
    $findStmt = $pdo->prepare('SELECT customer_id, customer_ref_id, assigned_to, current_basket_key FROM customers WHERE customer_ref_id = ? OR customer_id = ? LIMIT 1');
    $findStmt->execute([$orderCustomerId, is_numeric($orderCustomerId) ? (int)$orderCustomerId : null]);
    $customer = $findStmt->fetch(PDO::FETCH_ASSOC);
    
    if ($customer) {
        echo "<table>";
        echo "<tr><th>Customer ID (PK)</th><td><strong>{$customer['customer_id']}</strong></td></tr>";
        echo "<tr><th>Customer Ref ID</th><td>{$customer['customer_ref_id']}</td></tr>";
        echo "<tr><th>Assigned To</th><td><strong>{$customer['assigned_to']}</strong></td></tr>";
        echo "<tr><th>Current Basket Key</th><td class='warning'><strong>{$customer['current_basket_key']}</strong></td></tr>";
        echo "</table>";
        
        $customerPk = $customer['customer_id'];
        $assignedTo = (int)$customer['assigned_to'];
    } else {
        echo "<p class='error'>❌ ไม่พบ Customer!</p>";
        
        // Try alternative search
        echo "<h3>ลองค้นหาอีกวิธี...</h3>";
        $altStmt = $pdo->prepare("SELECT customer_id, customer_ref_id, assigned_to, current_basket_key FROM customers WHERE customer_id = ?");
        $altStmt->execute([$customerId]);
        $altCustomer = $altStmt->fetch(PDO::FETCH_ASSOC);
        
        if ($altCustomer) {
            echo "<p class='success'>พบโดยใช้ customer_id โดยตรง!</p>";
            echo "<table>";
            echo "<tr><th>Customer ID (PK)</th><td>{$altCustomer['customer_id']}</td></tr>";
            echo "<tr><th>Customer Ref ID</th><td>{$altCustomer['customer_ref_id']}</td></tr>";
            echo "</table>";
            
            echo "<p class='error'>⚠️ ปัญหา: Order.customer_id ({$orderCustomerId}) ไม่ตรงกับ Customer ที่คุณต้องการ!</p>";
        }
        exit;
    }
    echo "</div>";
    
    // ========== 3. ดึงข้อมูล Creator ==========
    echo "<div class='section'>";
    echo "<h2>3. ข้อมูล Creator</h2>";
    
    $creatorStmt = $pdo->prepare('SELECT id, username, role, role_id FROM users WHERE id = ?');
    $creatorStmt->execute([$creatorId]);
    $creator = $creatorStmt->fetch(PDO::FETCH_ASSOC);
    
    if ($creator) {
        echo "<table>";
        echo "<tr><th>Creator ID</th><td>{$creator['id']}</td></tr>";
        echo "<tr><th>Username</th><td>{$creator['username']}</td></tr>";
        echo "<tr><th>Role</th><td>{$creator['role']}</td></tr>";
        echo "<tr><th>Role ID</th><td><strong>{$creator['role_id']}</strong></td></tr>";
        echo "</table>";
        
        $creatorRoleId = (int)$creator['role_id'];
    } else {
        echo "<p class='error'>❌ ไม่พบ Creator!</p>";
        exit;
    }
    echo "</div>";
    
    // ========== 4. ตรวจสอบเงื่อนไข ==========
    echo "<div class='section'>";
    echo "<h2>4. ตรวจสอบเงื่อนไขการย้ายถัง</h2>";
    
    $cond1 = ($creatorRoleId === 6 || $creatorRoleId === 7);
    $cond2 = ($assignedTo === (int)$creatorId);
    
    echo "<table>";
    echo "<tr><th>เงื่อนไข</th><th>ค่า</th><th>ผลลัพธ์</th></tr>";
    echo "<tr><td>Creator Role ID เป็น 6 หรือ 7</td><td>role_id = {$creatorRoleId}</td><td>" . ($cond1 ? "<span class='success'>✅ ผ่าน</span>" : "<span class='error'>❌ ไม่ผ่าน</span>") . "</td></tr>";
    echo "<tr><td>Creator เป็นเจ้าของลูกค้า</td><td>assigned_to = {$assignedTo}, creator_id = {$creatorId}</td><td>" . ($cond2 ? "<span class='success'>✅ ผ่าน</span>" : "<span class='error'>❌ ไม่ผ่าน</span>") . "</td></tr>";
    echo "</table>";
    
    $shouldMove = $cond1 && $cond2;
    
    if ($shouldMove) {
        echo "<p class='success' style='font-size: 18px;'>✅ ทุกเงื่อนไขผ่าน - ควรย้ายไป Basket 39</p>";
    } else {
        echo "<p class='error' style='font-size: 18px;'>❌ เงื่อนไขไม่ผ่าน</p>";
    }
    echo "</div>";
    
    // ========== 5. ทดสอบย้ายถัง ==========
    echo "<div class='section'>";
    echo "<h2>5. ทดสอบย้ายถัง</h2>";
    
    if ($doMove && $shouldMove) {
        try {
            $basketUpdate = $pdo->prepare('UPDATE customers SET current_basket_key = 39 WHERE customer_id = ?');
            $basketUpdate->execute([$customerPk]);
            $affected = $basketUpdate->rowCount();
            
            echo "<p class='success' style='font-size: 20px;'>✅ อัปเดตสำเร็จ! ({$affected} row affected)</p>";
            
            // Verify
            $verifyStmt = $pdo->prepare('SELECT current_basket_key FROM customers WHERE customer_id = ?');
            $verifyStmt->execute([$customerPk]);
            $newBasket = $verifyStmt->fetchColumn();
            
            echo "<p>Current Basket Key ใหม่: <strong class='success'>{$newBasket}</strong></p>";
            echo "<p><a href='?customer_id={$customerId}&order_id={$orderId}'>🔄 รีเฟรช</a></p>";
            
        } catch (Exception $e) {
            echo "<p class='error'>❌ Error: " . $e->getMessage() . "</p>";
        }
    } else {
        if ($shouldMove) {
            echo "<p>กดปุ่มด้านล่างเพื่อทดสอบย้ายถังด้วยตนเอง:</p>";
            echo "<a class='btn' href='?customer_id={$customerId}&order_id={$orderId}&do_move=1'>🚀 ย้ายไป Basket 39 ตอนนี้เลย!</a>";
        } else {
            echo "<p class='warning'>ไม่สามารถย้ายได้เพราะเงื่อนไขไม่ผ่าน</p>";
        }
    }
    echo "</div>";
    
    echo "</body></html>";
    
} catch (Exception $e) {
    echo "<h1 class='error'>Error: " . htmlspecialchars($e->getMessage()) . "</h1>";
}
?>
