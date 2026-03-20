<?php
/**
 * Validate Creator Orders — ตรวจสอบ order_items ที่ creator_id ไม่ใช่ telesale/supervisor/admin
 *
 * GET ?company_id=1
 */
require_once __DIR__ . '/../config.php';

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

try {
    $pdo = db_connect();

    $companyId = isset($_GET['company_id']) ? (int) $_GET['company_id'] : 0;

    if ($companyId <= 0) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Invalid company_id']);
        exit();
    }

    // Find orders that have order_items with creator_id NOT belonging to telesale/supervisor/admin
    $sql = "
        SELECT 
            oi.order_id,
            o.order_date,
            o.order_status,
            o.total_amount,
            CONCAT(c.first_name, ' ', COALESCE(c.last_name, '')) AS customer_name,
            c.phone AS customer_phone,
            u.id AS creator_id,
            CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')) AS creator_name,
            u.role AS creator_role,
            COUNT(oi.id) AS affected_items
        FROM order_items oi
        JOIN orders o ON o.id = oi.parent_order_id
        LEFT JOIN customers c ON c.customer_id = o.customer_id
        LEFT JOIN users u ON u.id = oi.creator_id
        WHERE o.company_id = ?
          AND oi.creator_id IS NOT NULL
          AND oi.creator_id NOT IN (
              SELECT id FROM users 
              WHERE LOWER(role) LIKE '%telesale%'
                 OR LOWER(role) LIKE '%admin%'
          )
        GROUP BY oi.order_id, oi.creator_id
        ORDER BY o.order_date DESC
        LIMIT 500
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute([$companyId]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Count total orders (for context)
    $totalStmt = $pdo->prepare("SELECT COUNT(DISTINCT id) AS total FROM orders WHERE company_id = ?");
    $totalStmt->execute([$companyId]);
    $totalOrders = (int) $totalStmt->fetch()['total'];

    $results = array_map(function ($row) {
        return [
            'order_id' => $row['order_id'],
            'order_date' => $row['order_date'],
            'order_status' => $row['order_status'],
            'total_amount' => (float) $row['total_amount'],
            'customer_name' => trim($row['customer_name']),
            'customer_phone' => $row['customer_phone'],
            'creator_id' => (int) $row['creator_id'],
            'creator_name' => trim($row['creator_name']),
            'creator_role' => $row['creator_role'],
            'affected_items' => (int) $row['affected_items'],
        ];
    }, $rows);

    echo json_encode([
        'status' => 'success',
        'data' => $results,
        'summary' => [
            'total_orders' => $totalOrders,
            'flagged_count' => count($results),
        ],
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
?>
