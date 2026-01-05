<?php
/**
 * Script สำหรับค้นหาออเดอร์ที่ไม่ได้ระบุเพจ (sales_channel_page_id เป็น NULL หรือไม่มี)
 * Copy ไฟล์นี้ไปวางบน server แล้วเรียกผ่าน browser หรือ command line
 * 
 * Usage: php find_orders_no_page.php?month=1&year=2026&company_id=1
 */

ini_set('display_errors', 1);
error_reporting(E_ALL);

require_once __DIR__ . '/../config.php';

header("Content-Type: application/json; charset=UTF-8");

try {
    $pdo = db_connect();

    // Parameters - company_id is now OPTIONAL
    $companyId = isset($_GET['company_id']) && $_GET['company_id'] !== '' ? (int)$_GET['company_id'] : null;
    $month = isset($_GET['month']) ? (int)$_GET['month'] : (int)date('m');
    $year = isset($_GET['year']) ? (int)$_GET['year'] : (int)date('Y');

    // Build WHERE clause - company filter is optional
    $whereClause = "WHERE YEAR(o.order_date) = ? AND MONTH(o.order_date) = ?";
    $params = [$year, $month];
    
    if ($companyId !== null) {
        $whereClause .= " AND o.company_id = ?";
        $params[] = $companyId;
    }

    // Find orders with no page
    $sql = "
        SELECT 
            o.id as order_id,
            o.company_id,
            c.name as company_name,
            o.order_date,
            o.total_amount,
            o.order_status,
            o.payment_status,
            o.sales_channel_page_id,
            o.creator_id,
            CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) as creator_name
        FROM orders o
        LEFT JOIN users u ON o.creator_id = u.id
        LEFT JOIN companies c ON o.company_id = c.id
        $whereClause
          AND (o.sales_channel_page_id IS NULL OR o.sales_channel_page_id = 0 OR o.sales_channel_page_id = '')
          AND o.order_status NOT IN ('Cancelled', 'BadDebt')
        ORDER BY o.company_id, o.order_date DESC, o.id DESC
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Calculate total
    $totalAmount = 0;
    foreach ($orders as $order) {
        $totalAmount += (float)$order['total_amount'];
    }

    echo json_encode([
        'ok' => true,
        'filter' => [
            'company_id' => $companyId,
            'month' => $month,
            'year' => $year
        ],
        'summary' => [
            'total_orders' => count($orders),
            'total_amount' => $totalAmount
        ],
        'orders' => $orders
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}
