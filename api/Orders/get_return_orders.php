<?php
/**
 * get_return_orders.php
 * ดึงรายการ order boxes ที่มี return_status (ระบบจัดการตีกลับ)
 * ใช้ตาราง order_boxes แทน order_returns
 */

require_once __DIR__ . '/../config.php';
cors();
$pdo = db_connect();

header('Content-Type: application/json; charset=utf-8');

try {
    $status = $_GET['status'] ?? '';
    $page = max(1, intval($_GET['page'] ?? 1));
    $limit = max(1, min(100, intval($_GET['limit'] ?? 20)));
    $companyId = intval($_GET['companyId'] ?? 0);
    $offset = ($page - 1) * $limit;

    // ─── Build WHERE conditions ───
    $whereConditions = [];
    $params = [];

    // Filter by return_status
    if ($status) {
        $whereConditions[] = "ob.return_status = ?";
        $params[] = $status;
    } else {
        // Default: only show boxes that have a return_status set
        $whereConditions[] = "ob.return_status IS NOT NULL";
    }

    // Filter by company
    if ($companyId > 0) {
        $whereConditions[] = "o.company_id = ?";
        $params[] = $companyId;
    }

    $whereClause = count($whereConditions) > 0
        ? "WHERE " . implode(" AND ", $whereConditions)
        : "";

    // ─── Count total ───
    $countSql = "
        SELECT COUNT(DISTINCT ob.id) as total
        FROM order_boxes ob
        LEFT JOIN orders o ON ob.order_id = o.id
        $whereClause
    ";
    $stmtCount = $pdo->prepare($countSql);
    $stmtCount->execute($params);
    $total = (int) $stmtCount->fetchColumn();

    // ─── Fetch data ───
    $dataSql = "
        SELECT
            ob.id,
            ob.sub_order_id,
            ob.order_id as main_order_id,
            ob.box_number,
            ob.return_status as status,
            ob.return_note as note,
            ob.return_created_at as created_at,
            ob.updated_at,
            ob.collected_amount as return_amount,
            ob.collection_amount,
            otn.tracking_number,
            o.total_amount,
            o.order_date,
            o.company_id
        FROM order_boxes ob
        LEFT JOIN order_tracking_numbers otn
            ON ob.order_id = otn.parent_order_id AND ob.box_number = otn.box_number
        LEFT JOIN orders o ON ob.order_id = o.id
        $whereClause
        ORDER BY ob.return_created_at DESC, ob.id DESC
        LIMIT ? OFFSET ?
    ";
    $dataParams = array_merge($params, [$limit, $offset]);
    $stmtData = $pdo->prepare($dataSql);
    $stmtData->execute($dataParams);
    $rows = $stmtData->fetchAll(PDO::FETCH_ASSOC);

    $totalPages = max(1, ceil($total / $limit));

    echo json_encode([
        'status' => 'success',
        'data' => $rows,
        'pagination' => [
            'total' => $total,
            'totalPages' => $totalPages,
            'page' => $page,
            'limit' => $limit,
        ],
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage(),
    ]);
}