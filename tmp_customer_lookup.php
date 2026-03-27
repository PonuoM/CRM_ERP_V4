<?php
header('Content-Type: text/plain; charset=utf-8');
$conn = new mysqli('202.183.192.218', 'primacom_bloguser', 'pJnL53Wkhju2LaGPytw8', 'primacom_mini_erp');
$conn->set_charset("utf8mb4");
if ($conn->connect_error) die("Connection failed: " . $conn->connect_error);

echo "=== ค้นหาลูกค้า: พี่ออด 0656576035 ===\n\n";

// 1. Search customers by phone (multiple patterns)
echo "--- 1. ข้อมูลลูกค้า ---\n\n";

$sql = "SELECT c.customer_id, c.first_name, c.last_name, c.phone, c.backup_phone,
        c.company_id, comp.name as company_name, 
        c.grade, c.lifecycle_status, c.behavioral_status,
        c.assigned_to, u.name as assigned_to_name,
        c.current_basket_key, c.last_order_date, c.first_order_date,
        c.date_registered, c.total_purchases, c.order_count,
        c.street, c.subdistrict, c.district, c.province, c.postal_code,
        c.facebook_name, c.line_id
        FROM customers c
        LEFT JOIN companies comp ON c.company_id = comp.id
        LEFT JOIN users u ON c.assigned_to = u.id
        WHERE c.phone LIKE '%656576035%'
           OR c.backup_phone LIKE '%656576035%'
        ORDER BY c.company_id";

$result = $conn->query($sql);
if (!$result) { echo "Error: " . $conn->error . "\n"; exit; }

$customerIds = [];
while ($row = $result->fetch_assoc()) {
    $customerIds[] = $row['customer_id'];
    echo "Customer ID: {$row['customer_id']}\n";
    echo "  ชื่อ: {$row['first_name']} {$row['last_name']}\n";
    echo "  เบอร์หลัก: {$row['phone']}\n";
    echo "  เบอร์สำรอง: {$row['backup_phone']}\n";
    echo "  Company: {$row['company_name']} (ID:{$row['company_id']})\n";
    echo "  Grade: {$row['grade']}\n";
    echo "  Lifecycle: {$row['lifecycle_status']} | Behavioral: {$row['behavioral_status']}\n";
    echo "  Assigned to: {$row['assigned_to_name']} (ID:{$row['assigned_to']})\n";
    echo "  Basket: {$row['current_basket_key']}\n";
    echo "  ที่อยู่: {$row['street']}, {$row['subdistrict']}, {$row['district']}, {$row['province']} {$row['postal_code']}\n";
    echo "  Facebook: {$row['facebook_name']} | LINE: {$row['line_id']}\n";
    echo "  First Order: {$row['first_order_date']} | Last Order: {$row['last_order_date']}\n";
    echo "  Total Purchases: {$row['total_purchases']} | Order Count: {$row['order_count']}\n";
    echo "  Registered: {$row['date_registered']}\n";
    echo "  ---\n";
}
echo "\nพบลูกค้าทั้งหมด: " . count($customerIds) . " รายการ\n\n";

// For each customer, get details
if (!empty($customerIds)) {
    foreach ($customerIds as $custId) {
        $custInfo = $conn->query("SELECT c.customer_id, c.first_name, c.last_name, c.phone, c.company_id, comp.name as company_name 
                    FROM customers c LEFT JOIN companies comp ON c.company_id = comp.id 
                    WHERE c.customer_id = {$custId}")->fetch_assoc();
        
        echo "========================================\n";
        echo "=== Customer ID: {$custInfo['customer_id']} | {$custInfo['first_name']} {$custInfo['last_name']} | Phone: {$custInfo['phone']} ===\n";
        echo "=== Company: {$custInfo['company_name']} (ID:{$custInfo['company_id']}) ===\n";
        echo "========================================\n\n";
        
        // Call history
        echo "  --- ประวัติการโทร (call_history) ---\n";
        // check call_history columns first
        $callCols = $conn->query("SHOW COLUMNS FROM call_history");
        if (!$callCols) {
            echo "  Error checking call_history: " . $conn->error . "\n";
        } else {
            $colNames = [];
            while ($cc = $callCols->fetch_assoc()) $colNames[] = $cc['Field'];
            
            // Determine proper column names
            $custIdCol = in_array('customer_id', $colNames) ? 'customer_id' : 'customer';
            $dateCol = in_array('call_date', $colNames) ? 'call_date' : (in_array('created_at', $colNames) ? 'created_at' : 'call_time');
            $userIdCol = in_array('user_id', $colNames) ? 'user_id' : 'agent_id';
            
            $calls = $conn->query("SELECT ch.*, u.name as agent_name
                        FROM call_history ch
                        LEFT JOIN users u ON ch.{$userIdCol} = u.id
                        WHERE ch.{$custIdCol} = {$custId}
                        ORDER BY ch.{$dateCol} DESC
                        LIMIT 20");
            
            if ($calls) {
                $callCount = 0;
                while ($call = $calls->fetch_assoc()) {
                    $callCount++;
                    $dt = $call[$dateCol] ?? $call['created_at'] ?? '';
                    $dur = $call['duration'] ?? '';
                    $res = $call['result'] ?? $call['status'] ?? '';
                    $notes = $call['notes'] ?? $call['note'] ?? '';
                    echo "  [{$dt}] Agent: {$call['agent_name']} | Duration: {$dur}s | Result: {$res}\n";
                    if (!empty($notes)) echo "    Notes: " . mb_substr($notes, 0, 200, 'UTF-8') . "\n";
                }
                $totalCalls = $conn->query("SELECT COUNT(*) as cnt FROM call_history WHERE {$custIdCol} = {$custId}")->fetch_assoc();
                echo "  แสดง {$callCount} | ทั้งหมด: {$totalCalls['cnt']} สาย\n\n";
            } else {
                echo "  Query error: " . $conn->error . "\n\n";
            }
        }
        
        // Customer logs
        echo "  --- ประวัติกิจกรรม (customer_logs) ---\n";
        $logCols = $conn->query("SHOW COLUMNS FROM customer_logs");
        $lColNames = [];
        if ($logCols) while ($lc = $logCols->fetch_assoc()) $lColNames[] = $lc['Field'];
        
        $lCustCol = in_array('customer_id', $lColNames) ? 'customer_id' : 'customer';
        $lDateCol = in_array('created_at', $lColNames) ? 'created_at' : 'log_date';
        $lUserCol = in_array('user_id', $lColNames) ? 'user_id' : 'agent_id';
        $lActionCol = in_array('action', $lColNames) ? 'action' : 'type';
        
        $logs = $conn->query("SELECT cl.*, u.name as agent_name
                   FROM customer_logs cl
                   LEFT JOIN users u ON cl.{$lUserCol} = u.id
                   WHERE cl.{$lCustCol} = {$custId}
                   ORDER BY cl.{$lDateCol} DESC
                   LIMIT 20");
        
        if ($logs) {
            $logCount = 0;
            while ($log = $logs->fetch_assoc()) {
                $logCount++;
                $dt = $log[$lDateCol] ?? '';
                $action = $log[$lActionCol] ?? '';
                $details = $log['details'] ?? $log['note'] ?? $log['description'] ?? '';
                echo "  [{$dt}] Action: {$action} | Agent: {$log['agent_name']}\n";
                if (!empty($details)) echo "    Details: " . mb_substr($details, 0, 250, 'UTF-8') . "\n";
            }
            $totalLogs = $conn->query("SELECT COUNT(*) as cnt FROM customer_logs WHERE {$lCustCol} = {$custId}")->fetch_assoc();
            echo "  แสดง {$logCount} | ทั้งหมด: {$totalLogs['cnt']} logs\n\n";
        } else {
            echo "  Error: " . $conn->error . "\n\n";
        }
        
        // Orders
        echo "  --- ประวัติคำสั่งซื้อ (orders) ---\n";
        $orders = $conn->query("SELECT o.id, o.order_number, o.status, o.total_amount, o.net_amount,
                     o.payment_method, o.created_at, 
                     u.name as creator_name
                     FROM orders o
                     LEFT JOIN users u ON o.creator_id = u.id
                     WHERE o.customer_id = {$custId}
                     ORDER BY o.created_at DESC
                     LIMIT 20");
        
        if ($orders) {
            $orderCount = 0;
            while ($order = $orders->fetch_assoc()) {
                $orderCount++;
                echo "  [{$order['created_at']}] #{$order['order_number']} | Status: {$order['status']} | Total: {$order['total_amount']} | Net: {$order['net_amount']} | Pay: {$order['payment_method']} | By: {$order['creator_name']}\n";
            }
            $totalOrders = $conn->query("SELECT COUNT(*) as cnt FROM orders WHERE customer_id = {$custId}")->fetch_assoc();
            echo "  แสดง {$orderCount} | ทั้งหมด: {$totalOrders['cnt']} orders\n\n";
        } else {
            echo "  Error: " . $conn->error . "\n\n";
        }
        
        // Appointments
        echo "  --- นัดหมาย (appointments) ---\n";
        $apts = $conn->query("SELECT a.*, u.name as agent_name
                   FROM appointments a
                   LEFT JOIN users u ON a.user_id = u.id
                   WHERE a.customer_id = {$custId}
                   ORDER BY a.created_at DESC
                   LIMIT 15");
        
        if ($apts) {
            $aptCount = 0;
            while ($apt = $apts->fetch_assoc()) {
                $aptCount++;
                $dt = $apt['appointment_date'] ?? $apt['follow_up_date'] ?? $apt['created_at'] ?? '';
                $type = $apt['type'] ?? $apt['action'] ?? '';
                $status = $apt['status'] ?? '';
                $notes = $apt['notes'] ?? $apt['note'] ?? '';
                echo "  [{$dt}] Type: {$type} | Status: {$status} | Agent: {$apt['agent_name']}\n";
                if (!empty($notes)) echo "    Notes: " . mb_substr($notes, 0, 200, 'UTF-8') . "\n";
            }
            $totalApts = $conn->query("SELECT COUNT(*) as cnt FROM appointments WHERE customer_id = {$custId}")->fetch_assoc();
            echo "  แสดง {$aptCount} | ทั้งหมด: {$totalApts['cnt']} appointments\n\n";
        } else {
            echo "  Error: " . $conn->error . "\n\n";
        }
    }
}

$conn->close();
echo "\n=== เสร็จสิ้นการค้นหา ===\n";
