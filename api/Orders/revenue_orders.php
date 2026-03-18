<?php
/**
 * Revenue Orders List API
 * Returns orders matching a specific revenue category (returned/cancelled/upsell)
 * 
 * Parameters:
 *   company_id (required)
 *   month, year (required) 
 *   user_id (optional)
 *   type: 'returned' | 'cancelled' | 'upsell'
 */

require_once __DIR__ . '/../config.php';

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Max-Age: 3600");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

try {
    $pdo = db_connect();

    $companyId = isset($_GET['company_id']) ? (int) $_GET['company_id'] : 0;
    $month = isset($_GET['month']) ? (int) $_GET['month'] : (int) date('m');
    $year = isset($_GET['year']) ? (int) $_GET['year'] : (int) date('Y');
    $userId = isset($_GET['user_id']) ? (int) $_GET['user_id'] : null;
    $type = isset($_GET['type']) ? $_GET['type'] : '';

    if ($companyId <= 0 || !in_array($type, ['returned', 'cancelled', 'upsell'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid parameters. Required: company_id, type (returned|cancelled|upsell)']);
        exit();
    }

    $dateFilter = "AND YEAR(o.order_date) = ? AND MONTH(o.order_date) = ?";
    $params = [$companyId, $year, $month];

    $userFilter = "";
    if ($userId > 0) {
        $userFilter = "AND oi.creator_id = ?";
        $params[] = $userId;
    }

    if ($type === 'returned') {
        // Items in RETURNED boxes
        $sql = "
            SELECT 
                o.id as order_id,
                o.order_date,
                o.order_status,
                CONCAT(COALESCE(c.first_name, ''), ' ', COALESCE(c.last_name, '')) as customer_name,
                c.phone as customer_phone,
                COALESCE(SUM(COALESCE(oi.net_total, oi.quantity * oi.price_per_unit)), 0) as amount,
                GROUP_CONCAT(DISTINCT ob.box_number ORDER BY ob.box_number SEPARATOR ', ') as returned_boxes,
                COUNT(DISTINCT ob.box_number) as returned_count,
                (SELECT COUNT(DISTINCT ob2.box_number) FROM order_boxes ob2 WHERE ob2.sub_order_id LIKE CONCAT(o.id, '-%')) as total_boxes
            FROM order_items oi
            JOIN orders o ON oi.parent_order_id = o.id
            JOIN order_boxes ob ON ob.sub_order_id = oi.order_id
            LEFT JOIN customers c ON o.customer_id = c.customer_id AND c.company_id = o.company_id
            WHERE o.company_id = ?
            $dateFilter
            AND ob.status = 'RETURNED'
            AND (oi.is_freebie = 0 OR oi.is_freebie IS NULL)
            AND oi.parent_item_id IS NULL
            $userFilter
            GROUP BY o.id, o.order_date, o.order_status, customer_name, customer_phone
            ORDER BY o.order_date DESC
        ";
    } elseif ($type === 'cancelled') {
        // Cancelled orders
        $sql = "
            SELECT 
                o.id as order_id,
                o.order_date,
                o.order_status,
                CONCAT(COALESCE(c.first_name, ''), ' ', COALESCE(c.last_name, '')) as customer_name,
                c.phone as customer_phone,
                COALESCE(SUM(COALESCE(oi.net_total, oi.quantity * oi.price_per_unit)), 0) as amount
            FROM order_items oi
            JOIN orders o ON oi.parent_order_id = o.id
            LEFT JOIN customers c ON o.customer_id = c.customer_id AND c.company_id = o.company_id
            WHERE o.company_id = ?
            $dateFilter
            AND o.order_status = 'Cancelled'
            AND (oi.is_freebie = 0 OR oi.is_freebie IS NULL)
            AND oi.parent_item_id IS NULL
            $userFilter
            GROUP BY o.id, o.order_date, o.order_status, customer_name, customer_phone
            ORDER BY o.order_date DESC
        ";
    } else {
        // Upsell: basket_key_at_sale = 51
        $sql = "
            SELECT 
                o.id as order_id,
                o.order_date,
                o.order_status,
                CONCAT(COALESCE(c.first_name, ''), ' ', COALESCE(c.last_name, '')) as customer_name,
                c.phone as customer_phone,
                COALESCE(SUM(COALESCE(oi.net_total, oi.quantity * oi.price_per_unit)), 0) as amount,
                CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) as seller_name
            FROM order_items oi
            JOIN orders o ON oi.parent_order_id = o.id
            LEFT JOIN customers c ON o.customer_id = c.customer_id AND c.company_id = o.company_id
            LEFT JOIN users u ON oi.creator_id = u.id
            WHERE o.company_id = ?
            $dateFilter
            AND oi.basket_key_at_sale = 51
            AND o.order_status NOT IN ('Cancelled', 'BadDebt')
            AND (oi.is_freebie = 0 OR oi.is_freebie IS NULL)
            AND oi.parent_item_id IS NULL
            $userFilter
            GROUP BY o.id, o.order_date, o.order_status, customer_name, customer_phone, seller_name
            ORDER BY o.order_date DESC
        ";
    }

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Format amounts
    foreach ($orders as &$row) {
        $row['amount'] = (float) $row['amount'];
    }

    echo json_encode([
        'ok' => true,
        'type' => $type,
        'count' => count($orders),
        'orders' => $orders
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}
