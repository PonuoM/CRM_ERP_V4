<?php
/**
 * get_return_orders.php
 * ดึงรายการ order boxes ที่มี return_status (ระบบจัดการตีกลับ)
 * ใช้ตาราง order_boxes แทน order_returns
 * 
 * Performance: ไม่ COUNT ทั้งตาราง — ใช้ has_more แทน
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
    $search = trim($_GET['search'] ?? '');
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

    // Search by order ID, tracking number, or customer phone
    if ($search !== '') {
        $whereConditions[] = "(ob.order_id LIKE ? OR otn.tracking_number LIKE ? OR c.phone LIKE ?)";
        $searchWild = '%' . $search . '%';
        $params[] = $searchWild;
        $params[] = $searchWild;
        $params[] = $searchWild;
    }

    $whereClause = count($whereConditions) > 0
        ? "WHERE " . implode(" AND ", $whereConditions)
        : "";

    // ─── Fetch data (limit + 1 to detect has_more) ───
    $fetchLimit = $limit + 1;
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
            o.company_id,
            (SELECT COUNT(*) FROM order_boxes ob2 WHERE ob2.order_id = ob.order_id) as total_boxes
        FROM order_boxes ob
        LEFT JOIN order_tracking_numbers otn
            ON ob.order_id = otn.parent_order_id AND ob.box_number = otn.box_number
        LEFT JOIN orders o ON ob.order_id = o.id
        LEFT JOIN customers c ON o.customer_id = c.customer_id
        $whereClause
        ORDER BY ob.return_created_at DESC, ob.id DESC
        LIMIT ? OFFSET ?
    ";
    $dataParams = array_merge($params, [$fetchLimit, $offset]);
    $stmtData = $pdo->prepare($dataSql);
    $stmtData->execute($dataParams);
    $rows = $stmtData->fetchAll(PDO::FETCH_ASSOC);

    // Determine has_more: if we got more than $limit rows, there are more pages
    $hasMore = count($rows) > $limit;
    if ($hasMore) {
        array_pop($rows); // Remove the extra row
    }

    echo json_encode([
        'status' => 'success',
        'data' => $rows,
        'pagination' => [
            'page' => $page,
            'limit' => $limit,
            'hasMore' => $hasMore,
        ],
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage(),
    ]);
}