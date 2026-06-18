<?php
/**
 * อัปเดตข้อมูลการติดตามการซื้อของลูกค้าอัตโนมัติ
 * เรียกใช้เมื่อมีออเดอร์ใหม่
 */

require_once 'config.php';

function updateCustomerOrderTracking($customerId, $orderDate) {
    global $pdo;
    
    try {
        // เริ่ม transaction
        $pdo->beginTransaction();
        
        // ดึงข้อมูลลูกค้าปัจจุบัน
        $stmt = $pdo->prepare("
            SELECT first_order_date, last_order_date, order_count 
            FROM customers 
            WHERE id = ?
        ");
        $stmt->execute([$customerId]);
        $customer = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$customer) {
            throw new Exception("ไม่พบลูกค้า ID: $customerId");
        }
        
        $firstOrderDate = $customer['first_order_date'];
        $lastOrderDate = $customer['last_order_date'];
        $orderCount = (int)$customer['order_count'] + 1;
        
        // ถ้ายังไม่มี first_order_date ให้ตั้งเป็นวันที่ออเดอร์นี้
        if (!$firstOrderDate) {
            $firstOrderDate = $orderDate;
        }
        
        // อัปเดต last_order_date เป็นวันที่ออเดอร์ล่าสุด
        $lastOrderDate = $orderDate;
        
        // กำหนดสถานะลูกค้า
        $isNewCustomer = ($orderCount == 1);
        $isRepeatCustomer = ($orderCount > 1);
        
        // อัปเดตข้อมูลลูกค้า
        $updateStmt = $pdo->prepare("
            UPDATE customers 
            SET 
                first_order_date = ?,
                last_order_date = ?,
                order_count = ?,
                is_new_customer = ?,
                is_repeat_customer = ?
            WHERE id = ?
        ");
        
        $updateStmt->execute([
            $firstOrderDate,
            $lastOrderDate,
            $orderCount,
            $isNewCustomer ? 1 : 0,
            $isRepeatCustomer ? 1 : 0,
            $customerId
        ]);
        
        $pdo->commit();
        
        return [
            'success' => true,
            'customer_id' => $customerId,
            'first_order_date' => $firstOrderDate,
            'last_order_date' => $lastOrderDate,
            'order_count' => $orderCount,
            'is_new_customer' => $isNewCustomer,
            'is_repeat_customer' => $isRepeatCustomer
        ];
        
    } catch (Exception $e) {
        $pdo->rollBack();
        return [
            'success' => false,
            'error' => $e->getMessage()
        ];
    }
}

// ฟังก์ชันสำหรับอัปเดตข้อมูลลูกค้าทั้งหมด (ใช้ครั้งเดียว)
function updateAllCustomersOrderTracking() {
    global $pdo;
    
    try {
        // คำนวณข้อมูลการซื้อสำหรับลูกค้าทั้งหมด
        $stmt = $pdo->prepare("
            UPDATE customers c
            SET 
                first_order_date = (
                    SELECT MIN(order_date) 
                    FROM orders o 
                    WHERE o.customer_id = c.id 
                    AND o.order_status != 'Cancelled'
                ),
                last_order_date = (
                    SELECT MAX(order_date) 
                    FROM orders o 
                    WHERE o.customer_id = c.id 
                    AND o.order_status != 'Cancelled'
                ),
                order_count = (
                    SELECT COUNT(*) 
                    FROM orders o 
                    WHERE o.customer_id = c.id 
                    AND o.order_status != 'Cancelled'
                ),
                is_new_customer = (
                    SELECT COUNT(*) = 1 
                    FROM orders o 
                    WHERE o.customer_id = c.id 
                    AND o.order_status != 'Cancelled'
                ),
                is_repeat_customer = (
                    SELECT COUNT(*) > 1 
                    FROM orders o 
                    WHERE o.customer_id = c.id 
                    AND o.order_status != 'Cancelled'
                )
            WHERE EXISTS (
                SELECT 1 FROM orders o WHERE o.customer_id = c.id
            )
        ");
        
        $stmt->execute();
        
        return [
            'success' => true,
            'message' => 'อัปเดตข้อมูลการติดตามการซื้อของลูกค้าทั้งหมดเรียบร้อยแล้ว'
        ];
        
    } catch (Exception $e) {
        return [
            'success' => false,
            'error' => $e->getMessage()
        ];
    }
}

// API endpoint
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $action = $input['action'] ?? '';
    
    switch ($action) {
        case 'update_single':
            $customerId = $input['customer_id'] ?? null;
            $orderDate = $input['order_date'] ?? null;
            
            if (!$customerId || !$orderDate) {
                echo json_encode([
                    'success' => false,
                    'error' => 'ต้องระบุ customer_id และ order_date'
                ]);
                exit;
            }
            
            $result = updateCustomerOrderTracking($customerId, $orderDate);
            echo json_encode($result);
            break;
            
        case 'update_all':
            $result = updateAllCustomersOrderTracking();
            echo json_encode($result);
            break;
            
        default:
            echo json_encode([
                'success' => false,
                'error' => 'ไม่พบ action ที่ระบุ'
            ]);
            break;
    }
} else {
    echo json_encode([
        'success' => false,
        'error' => 'รองรับเฉพาะ POST request'
    ]);
}
?>
