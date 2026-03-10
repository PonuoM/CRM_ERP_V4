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
    $limit = max(1, min(2000, intval($_GET['limit'] ?? 50)));
    $companyId = intval($_GET['companyId'] ?? 0);
    $search = trim($_GET['search'] ?? '');
    $orderDateFrom = trim($_GET['orderDateFrom'] ?? '');
    $orderDateTo = trim($_GET['orderDateTo'] ?? '');
    $returnDateFrom = trim($_GET['returnDateFrom'] ?? '');
    $returnDateTo = trim($_GET['returnDateTo'] ?? '');
    // Advanced filters
    $caseStatus = trim($_GET['caseStatus'] ?? '');       // 'closed' | 'open'
    $hasClaim = trim($_GET['hasClaim'] ?? '');             // 'yes' | 'no'
    $claimMin = trim($_GET['claimMin'] ?? '');
    $claimMax = trim($_GET['claimMax'] ?? '');
    $amountMin = trim($_GET['amountMin'] ?? '');
    $amountMax = trim($_GET['amountMax'] ?? '');
    $hasImage = trim($_GET['hasImage'] ?? '');             // 'yes' | 'no'
    $hasNote = trim($_GET['hasNote'] ?? '');               // 'yes' | 'no'
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

    // Filter by order_date range
    if ($orderDateFrom !== '') {
        $whereConditions[] = "DATE(o.order_date) >= ?";
        $params[] = $orderDateFrom;
    }
    if ($orderDateTo !== '') {
        $whereConditions[] = "DATE(o.order_date) <= ?";
        $params[] = $orderDateTo;
    }

    // Filter by return_created_at range
    if ($returnDateFrom !== '') {
        $whereConditions[] = "DATE(ob.return_created_at) >= ?";
        $params[] = $returnDateFrom;
    }
    if ($returnDateTo !== '') {
        $whereConditions[] = "DATE(ob.return_created_at) <= ?";
        $params[] = $returnDateTo;
    }

    // ─── Advanced Filters ───
    // Case status
    if ($caseStatus === 'closed') {
        $whereConditions[] = "ob.return_complete = 1";
    } elseif ($caseStatus === 'open') {
        $whereConditions[] = "(ob.return_complete IS NULL OR ob.return_complete = 0)";
    }

    // Has claim
    if ($hasClaim === 'yes') {
        $whereConditions[] = "ob.return_claim IS NOT NULL AND ob.return_claim > 0";
    } elseif ($hasClaim === 'no') {
        $whereConditions[] = "(ob.return_claim IS NULL OR ob.return_claim = 0)";
    }

    // Claim amount range
    if ($claimMin !== '') {
        $whereConditions[] = "ob.return_claim >= ?";
        $params[] = floatval($claimMin);
    }
    if ($claimMax !== '') {
        $whereConditions[] = "ob.return_claim <= ?";
        $params[] = floatval($claimMax);
    }

    // Box amount range (cod_amount)
    if ($amountMin !== '') {
        $whereConditions[] = "ob.cod_amount >= ?";
        $params[] = floatval($amountMin);
    }
    if ($amountMax !== '') {
        $whereConditions[] = "ob.cod_amount <= ?";
        $params[] = floatval($amountMax);
    }

    // Has image
    if ($hasImage === 'yes') {
        $whereConditions[] = "EXISTS (SELECT 1 FROM return_images ri WHERE ri.sub_order_id = ob.sub_order_id)";
    } elseif ($hasImage === 'no') {
        $whereConditions[] = "NOT EXISTS (SELECT 1 FROM return_images ri WHERE ri.sub_order_id = ob.sub_order_id)";
    }

    // Has note
    if ($hasNote === 'yes') {
        $whereConditions[] = "ob.return_note IS NOT NULL AND ob.return_note != ''";
    } elseif ($hasNote === 'no') {
        $whereConditions[] = "(ob.return_note IS NULL OR ob.return_note = '')";
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
            ob.cod_amount as return_amount,
            ob.collection_amount,
            ob.return_complete,
            ob.return_claim,
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