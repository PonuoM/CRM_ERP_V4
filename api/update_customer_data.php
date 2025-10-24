<?php
/**
 * หน้าสำหรับอัปเดตข้อมูลลูกค้าที่มีอยู่แล้ว
 * ให้ข้อมูลการติดตามการซื้อ
 */

require_once 'config.php';

try {
    // เริ่ม transaction
    $pdo->beginTransaction();
    
    echo "<h2>กำลังอัปเดตข้อมูลลูกค้า...</h2>";
    echo "<p>เริ่มต้น: " . date('Y-m-d H:i:s') . "</p>";
    
    // อัปเดตข้อมูลลูกค้าทั้งหมดที่มีออเดอร์
    $updateQuery = "
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
    ";
    
    $stmt = $pdo->prepare($updateQuery);
    $result = $stmt->execute();
    
    if ($result) {
        $affectedRows = $stmt->rowCount();
        echo "<p style='color: green;'>✅ อัปเดตสำเร็จ: $affectedRows รายการ</p>";
    } else {
        throw new Exception("การอัปเดตล้มเหลว");
    }
    
    // ตรวจสอบผลลัพธ์
    $checkQuery = "
        SELECT 
            COUNT(*) as total_customers,
            COUNT(first_order_date) as customers_with_orders,
            COUNT(CASE WHEN is_new_customer = 1 THEN 1 END) as new_customers,
            COUNT(CASE WHEN is_repeat_customer = 1 THEN 1 END) as repeat_customers
        FROM customers
    ";
    
    $stmt = $pdo->prepare($checkQuery);
    $stmt->execute();
    $stats = $stmt->fetch(PDO::FETCH_ASSOC);
    
    echo "<h3>📊 สถิติข้อมูลหลังอัปเดต:</h3>";
    echo "<ul>";
    echo "<li>ลูกค้าทั้งหมด: " . $stats['total_customers'] . " รายการ</li>";
    echo "<li>ลูกค้าที่มีออเดอร์: " . $stats['customers_with_orders'] . " รายการ</li>";
    echo "<li>ลูกค้าใหม่ (ซื้อครั้งเดียว): " . $stats['new_customers'] . " รายการ</li>";
    echo "<li>ลูกค้ากลับมา (ซื้อซ้ำ): " . $stats['repeat_customers'] . " รายการ</li>";
    echo "</ul>";
    
    // แสดงตัวอย่างข้อมูล
    $sampleQuery = "
        SELECT 
            id, 
            first_name, 
            last_name,
            first_order_date,
            last_order_date,
            order_count,
            is_new_customer,
            is_repeat_customer
        FROM customers 
        WHERE first_order_date IS NOT NULL 
        ORDER BY first_order_date DESC 
        LIMIT 10
    ";
    
    $stmt = $pdo->prepare($sampleQuery);
    $stmt->execute();
    $samples = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "<h3>🔍 ตัวอย่างข้อมูลลูกค้า:</h3>";
    echo "<table border='1' style='border-collapse: collapse; width: 100%;'>";
    echo "<tr style='background-color: #f0f0f0;'>";
    echo "<th>ID</th><th>ชื่อ</th><th>ซื้อครั้งแรก</th><th>ซื้อล่าสุด</th><th>จำนวนครั้ง</th><th>ใหม่</th><th>กลับมา</th>";
    echo "</tr>";
    
    foreach ($samples as $customer) {
        echo "<tr>";
        echo "<td>" . $customer['id'] . "</td>";
        echo "<td>" . $customer['first_name'] . " " . $customer['last_name'] . "</td>";
        echo "<td>" . ($customer['first_order_date'] ? date('Y-m-d H:i', strtotime($customer['first_order_date'])) : '-') . "</td>";
        echo "<td>" . ($customer['last_order_date'] ? date('Y-m-d H:i', strtotime($customer['last_order_date'])) : '-') . "</td>";
        echo "<td>" . $customer['order_count'] . "</td>";
        echo "<td>" . ($customer['is_new_customer'] ? '✅' : '❌') . "</td>";
        echo "<td>" . ($customer['is_repeat_customer'] ? '✅' : '❌') . "</td>";
        echo "</tr>";
    }
    echo "</table>";
    
    $pdo->commit();
    
    echo "<p style='color: green; font-weight: bold;'>🎉 การอัปเดตข้อมูลสำเร็จเรียบร้อย!</p>";
    echo "<p>ตอนนี้หน้าแชร์รายชื่อจะแสดงข้อมูลที่ถูกต้องแล้ว</p>";
    
} catch (Exception $e) {
    $pdo->rollBack();
    echo "<p style='color: red;'>❌ เกิดข้อผิดพลาด: " . $e->getMessage() . "</p>";
}
?>

<style>
body { font-family: Arial, sans-serif; margin: 20px; }
h2, h3 { color: #333; }
table { margin-top: 10px; }
th, td { padding: 8px; text-align: left; }
</style>
