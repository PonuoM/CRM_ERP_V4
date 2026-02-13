<?php
/**
 * export_return_orders.php
 * Export ข้อมูลกล่องที่มี status = 'RETURNED' ตามช่วงวันที่ (orders.order_date)
 * ไม่มี pagination — ดึงทั้งหมดสำหรับ export
 */

require_once __DIR__ . '/../config.php';
cors();
$pdo = db_connect();

header('Content-Type: application/json; charset=utf-8');

try {
    $dateFrom = $_GET['date_from'] ?? '';
    $dateTo = $_GET['date_to'] ?? '';
    $companyId = intval($_GET['companyId'] ?? 0);

    if (!$dateFrom || !$dateTo) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'date_from and date_to are required']);
        exit;
    }

    $whereConditions = ["ob.status = 'RETURNED'"];
    $params = [];

    // Date range filter on orders.order_date
    $whereConditions[] = "DATE(o.order_date) >= ?";
    $params[] = $dateFrom;
    $whereConditions[] = "DATE(o.order_date) <= ?";
    $params[] = $dateTo;

    // Company filter
    if ($companyId > 0) {
        $whereConditions[] = "o.company_id = ?";
        $params[] = $companyId;
    }

    $whereClause = "WHERE " . implode(" AND ", $whereConditions);

    $sql = "
        SELECT
            ob.order_id,
            ob.sub_order_id,
            ob.box_number,
            ob.status as box_status,
            ob.return_status,
            ob.return_note,
            ob.return_created_at,
            ob.cod_amount,
            ob.collection_amount,
            otn.tracking_number,
            o.order_date,
            o.total_amount as order_total_amount,
            o.order_status,
            o.payment_method,
            c.first_name as customer_first_name,
            c.last_name as customer_last_name,
            c.phone as customer_phone,
            o.street as shipping_street,
            o.subdistrict as shipping_subdistrict,
            o.district as shipping_district,
            o.province as shipping_province,
            o.postal_code as shipping_postal_code,
            u.first_name as seller_first_name,
            u.last_name as seller_last_name,
            u.role as seller_role,
            (SELECT COALESCE(SUM(ob2.cod_amount), 0) FROM order_boxes ob2 WHERE ob2.order_id = ob.order_id) as total_cod_amount,
            (SELECT COALESCE(SUM(ob2.collection_amount), 0) FROM order_boxes ob2 WHERE ob2.order_id = ob.order_id) as total_collection_amount
        FROM order_boxes ob
        LEFT JOIN order_tracking_numbers otn
            ON ob.order_id = otn.parent_order_id AND ob.box_number = otn.box_number
        LEFT JOIN orders o ON ob.order_id = o.id
        LEFT JOIN customers c ON o.customer_id = c.customer_id
        LEFT JOIN users u ON o.creator_id = u.id
        $whereClause
        ORDER BY o.order_date DESC, ob.order_id, ob.box_number
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'data' => $rows,
        'total' => count($rows),
    ], JSON_UNESCAPED_UNICODE);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage(),
    ]);
}
