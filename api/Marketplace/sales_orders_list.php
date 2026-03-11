<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET");

require_once __DIR__ . '/../config.php';

try {
    $conn = db_connect();
    $companyId = $_GET['company_id'] ?? null;
    $batchId = $_GET['batch_id'] ?? null;
    $storeId = $_GET['store_id'] ?? null;
    $status = $_GET['status'] ?? null;
    $dateFrom = $_GET['date_from'] ?? null;
    $dateTo = $_GET['date_to'] ?? null;
    $page = max(1, intval($_GET['page'] ?? 1));
    $limit = min(200, max(10, intval($_GET['limit'] ?? 50)));

    $where = [];
    $params = [];

    if ($companyId) { $where[] = "o.company_id = ?"; $params[] = $companyId; }
    if ($batchId) { $where[] = "o.batch_id = ?"; $params[] = $batchId; }
    if ($storeId) { $where[] = "o.store_id = ?"; $params[] = $storeId; }
    if ($status) { $where[] = "o.status = ?"; $params[] = $status; }
    if ($dateFrom) { $where[] = "o.order_date >= ?"; $params[] = $dateFrom; }
    if ($dateTo) { $where[] = "o.order_date <= ?"; $params[] = $dateTo; }

    $whereSql = count($where) ? "WHERE " . implode(" AND ", $where) : "";
    $offset = ($page - 1) * $limit;

    // Count
    $countStmt = $conn->prepare("SELECT COUNT(*) as total FROM marketplace_sales_orders o $whereSql");
    $countStmt->execute($params);
    $total = $countStmt->fetch(PDO::FETCH_ASSOC)['total'];

    // Summary
    $sumStmt = $conn->prepare("
        SELECT 
            COALESCE(SUM(o.total_price), 0) as sum_sales,
            COALESCE(SUM(o.quantity), 0) as sum_quantity,
            COUNT(DISTINCT o.online_order_id) as unique_orders,
            SUM(CASE WHEN o.order_status = 'ยกเลิกแล้ว' THEN 1 ELSE 0 END) as cancelled_count,
            SUM(CASE WHEN o.order_status = 'จัดส่งแล้ว' THEN 1 ELSE 0 END) as shipped_count
        FROM marketplace_sales_orders o $whereSql
    ");
    $sumStmt->execute($params);
    $summary = $sumStmt->fetch(PDO::FETCH_ASSOC);

    // Data
    $query = "
        SELECT o.*
        FROM marketplace_sales_orders o
        $whereSql
        ORDER BY o.order_date DESC, o.id DESC
        LIMIT $limit OFFSET $offset
    ";
    $stmt = $conn->prepare($query);
    $stmt->execute($params);
    $data = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        "success" => true,
        "data" => $data,
        "total" => intval($total),
        "page" => $page,
        "limit" => $limit,
        "summary" => $summary
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["success" => false, "error" => $e->getMessage()]);
}
?>
