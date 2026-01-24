<?php
/**
 * Debug Script: ทดสอบการ Update last_order_date
 * URL: /api/cron/debug_last_order_date.php?customer_id=300800
 * URL: /api/cron/debug_last_order_date.php?customer_id=300800&create_order=1 (สร้าง Order ทดสอบ)
 * URL: /api/cron/debug_last_order_date.php?customer_id=300800&test_update=1 (ทดสอบ Manual Update)
 */

require_once __DIR__ . '/../config.php';

header('Content-Type: text/html; charset=utf-8');

$customerId = $_GET['customer_id'] ?? 300800;

echo "<html><head><meta charset='utf-8'><title>Debug last_order_date</title>";
echo "<style>
    body { font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5; }
    .section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 8px; background: white; }
    h1 { color: #333; }
    h2 { margin-top: 0; color: #2E7D32; }
    table { border-collapse: collapse; margin: 10px 0; }
    th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
    th { background: #f5f5f5; }
    .success { color: green; font-weight: bold; }
    .error { color: red; font-weight: bold; }
    pre { background: #eee; padding: 10px; overflow: auto; font-size: 12px; }
    .btn { display: inline-block; padding: 10px 20px; background: #2196F3; color: white; text-decoration: none; border-radius: 4px; margin: 5px; }
    .btn-green { background: #4CAF50; }
    .btn-orange { background: #FF9800; }
</style></head><body>";

echo "<h1>🔍 Debug last_order_date Update</h1>";
echo "<p>เวลาทดสอบ: " . date('Y-m-d H:i:s') . "</p>";
echo "<p>Customer ID: <strong>$customerId</strong></p>";

try {
    $pdo = db_connect();
    
    // ========== CREATE ORDER TEST ==========
    if (isset($_GET['create_order'])) {
        echo "<div class='section' style='background: #E8F5E9;'>";
        echo "<h2>🆕 สร้าง Order ทดสอบ</h2>";
        
        // Check last order for this customer to increment date
        $lastOrderStmt = $pdo->prepare("SELECT MAX(order_date) as last_date, COUNT(*) as cnt FROM orders WHERE customer_id = ?");
        $lastOrderStmt->execute([$customerId]);
        $lastOrderData = $lastOrderStmt->fetch(PDO::FETCH_ASSOC);
        
        $orderCount = (int)$lastOrderData['cnt'];
        
        // Generate unique order ID
        $orderId = "TEST-{$customerId}-" . ($orderCount + 1);
        
        // Order date: increment by 1 day from last order or use current date
        if ($lastOrderData['last_date']) {
            $orderDate = date('Y-m-d H:i:s', strtotime($lastOrderData['last_date'] . ' +1 day'));
        } else {
            $orderDate = date('Y-m-d H:i:s');
        }
        
        $orderData = [
            'id' => $orderId,
            'customer_id' => $customerId,
            'order_date' => $orderDate,
            'delivery_date' => date('Y-m-d', strtotime($orderDate . ' +4 days')),
            'total_amount' => 200.00,
            'payment_method' => 'PayAfter',
            'order_status' => 'Pending',
            'notes' => 'Test order created by debug script',
            'recipient_first_name' => 'ปิยะ 722',
            'recipient_last_name' => 'เจริญศรี',
            'recipient_phone' => '0818353806',
            'shipping_address' => '5555555',
            'shipping_province' => 'ปทุมธานี',
            'shipping_district' => 'ธัญบุรี',
            'shipping_subdistrict' => 'บึงน้ำรักษ์',
            'shipping_postal_code' => '12110',
            'creator_id' => 1,
        ];
        
        echo "<p>Order Data:</p>";
        echo "<pre>" . json_encode($orderData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "</pre>";
        
        try {
            // Insert Order with minimal columns
            $insertStmt = $pdo->prepare("
                INSERT INTO orders (id, customer_id, order_date, delivery_date, total_amount, payment_method, order_status, notes, creator_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $insertStmt->execute([
                $orderData['id'], 
                $orderData['customer_id'], 
                $orderData['order_date'], 
                $orderData['delivery_date'], 
                $orderData['total_amount'], 
                $orderData['payment_method'],
                $orderData['order_status'], 
                $orderData['notes'], 
                $orderData['creator_id']
            ]);
            
            echo "<p class='success'>✅ Order Created: $orderId</p>";
            
            // Now test the customer update logic (same as index.php)
            echo "<h3>🔄 รัน Logic Update Customer (เหมือน index.php)</h3>";
            
            $customerCheck = $pdo->prepare('SELECT customer_id, total_purchases FROM customers WHERE customer_ref_id = ? OR customer_id = ? LIMIT 1');
            $customerCheck->execute([$customerId, is_numeric($customerId) ? (int)$customerId : 0]);
            $customerData = $customerCheck->fetch(PDO::FETCH_ASSOC);
            
            if ($customerData) {
                $customerPk = $customerData['customer_id'];
                $orderTotal = $orderData['total_amount'];
                
                if ($orderTotal > 0) {
                    $currentTotal = floatval($customerData['total_purchases'] ?? 0);
                    $newTotal = $currentTotal + $orderTotal;
                    
                    $newGrade = 'D';
                    if ($newTotal >= 50000) {
                        $newGrade = 'A';
                    } else if ($newTotal >= 10000) {
                        $newGrade = 'B';
                    } else if ($newTotal >= 5000) {
                        $newGrade = 'C';
                    }
                    
                    $updateCustomer = $pdo->prepare('UPDATE customers SET total_purchases = ?, grade = ?, last_order_date = ? WHERE customer_id = ?');
                    $updateCustomer->execute([$newTotal, $newGrade, $orderData['order_date'], $customerPk]);
                    $affected = $updateCustomer->rowCount();
                    
                    echo "<p class='success'>✅ Customer Updated: total_purchases=$newTotal, grade=$newGrade, last_order_date={$orderData['order_date']} (Affected: $affected rows)</p>";
                } else {
                    $updateCustomer = $pdo->prepare('UPDATE customers SET last_order_date = ? WHERE customer_id = ?');
                    $updateCustomer->execute([$orderData['order_date'], $customerPk]);
                    $affected = $updateCustomer->rowCount();
                    
                    echo "<p class='success'>✅ Customer Updated: last_order_date={$orderData['order_date']} (Affected: $affected rows)</p>";
                }
                
                // Verify
                $verify = $pdo->prepare("SELECT last_order_date, total_purchases, grade FROM customers WHERE customer_id = ?");
                $verify->execute([$customerPk]);
                $verifyData = $verify->fetch(PDO::FETCH_ASSOC);
                echo "<p><strong>ข้อมูลหลัง Update:</strong></p>";
                echo "<pre>" . json_encode($verifyData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "</pre>";
                
            } else {
                echo "<p class='error'>❌ ไม่พบ Customer to update!</p>";
            }
            
        } catch (PDOException $e) {
            if (strpos($e->getMessage(), 'Duplicate entry') !== false) {
                echo "<p class='error'>❌ Order ID ซ้ำ! ลอง refresh หน้าเพื่อ generate ID ใหม่</p>";
            } else {
                echo "<p class='error'>❌ Error: " . htmlspecialchars($e->getMessage()) . "</p>";
            }
        }
        
        echo "</div>";
    }
    
    // ========== MANUAL UPDATE TEST ==========
    if (isset($_GET['test_update'])) {
        echo "<div class='section' style='background: #FFF3E0;'>";
        echo "<h2>🔧 ทดสอบ Manual Update last_order_date</h2>";
        
        $testDate = date('Y-m-d H:i:s');
        $updateStmt = $pdo->prepare('UPDATE customers SET last_order_date = ? WHERE customer_id = ?');
        $result = $updateStmt->execute([$testDate, $customerId]);
        $affected = $updateStmt->rowCount();
        
        if ($result && $affected > 0) {
            echo "<p class='success'>✅ Manual Update สำเร็จ! last_order_date = $testDate (Affected: $affected rows)</p>";
        } else {
            echo "<p class='error'>❌ Update ไม่มี rows affected!</p>";
        }
        
        $recheck = $pdo->prepare("SELECT last_order_date FROM customers WHERE customer_id = ?");
        $recheck->execute([$customerId]);
        $newVal = $recheck->fetchColumn();
        echo "<p>ค่า last_order_date หลัง update: <strong>" . ($newVal ?? 'NULL') . "</strong></p>";
        echo "</div>";
    }
    
    // ========== CURRENT CUSTOMER DATA ==========
    echo "<div class='section'>";
    echo "<h2>📋 ข้อมูลลูกค้าปัจจุบัน</h2>";
    
    $custStmt = $pdo->prepare("SELECT customer_id, first_name, last_name, last_order_date, total_purchases, grade, updated_at FROM customers WHERE customer_id = ?");
    $custStmt->execute([$customerId]);
    $customer = $custStmt->fetch(PDO::FETCH_ASSOC);
    
    if ($customer) {
        echo "<table>";
        foreach ($customer as $key => $value) {
            $highlight = ($key === 'last_order_date') ? "style='background: yellow;'" : "";
            echo "<tr $highlight><th>$key</th><td>" . ($value ?? 'NULL') . "</td></tr>";
        }
        echo "</table>";
    } else {
        echo "<p class='error'>❌ ไม่พบ Customer ID: $customerId</p>";
    }
    echo "</div>";
    
    // ========== ORDERS ==========
    echo "<div class='section'>";
    echo "<h2>📦 Orders ของลูกค้านี้</h2>";
    
    $ordersStmt = $pdo->prepare("SELECT id, order_date, order_status, total_amount FROM orders WHERE customer_id = ? ORDER BY order_date DESC LIMIT 10");
    $ordersStmt->execute([$customerId]);
    $orders = $ordersStmt->fetchAll(PDO::FETCH_ASSOC);
    
    if ($orders) {
        echo "<table>";
        echo "<tr><th>ID</th><th>Order Date</th><th>Status</th><th>Total Amount</th></tr>";
        foreach ($orders as $order) {
            echo "<tr>";
            foreach ($order as $val) {
                echo "<td>" . ($val ?? 'NULL') . "</td>";
            }
            echo "</tr>";
        }
        echo "</table>";
    } else {
        echo "<p>ไม่พบ orders</p>";
    }
    echo "</div>";
    
    // ========== ACTION BUTTONS ==========
    echo "<div class='section'>";
    echo "<h2>🎮 Actions</h2>";
    echo "<a class='btn btn-green' href='?customer_id=$customerId&create_order=1'>➕ สร้าง Order ทดสอบ</a>";
    echo "<a class='btn btn-orange' href='?customer_id=$customerId&test_update=1'>🔧 Manual Update last_order_date</a>";
    echo "<a class='btn' href='?customer_id=$customerId'>🔄 Refresh</a>";
    echo "</div>";
    
} catch (Exception $e) {
    echo "<p class='error'>Error: " . htmlspecialchars($e->getMessage()) . "</p>";
}

echo "</body></html>";
?>
