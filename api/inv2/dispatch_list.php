<?php
// Dispatch List API — List dispatch batches
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

require_once __DIR__ . '/../config.php';
$pdo = db_connect();

try {
    $page = isset($_GET['page']) ? max(1, (int)$_GET['page']) : 1;
    $pageSize = isset($_GET['pageSize']) ? min(100, max(1, (int)$_GET['pageSize'])) : 20;
    $offset = ($page - 1) * $pageSize;

    $where = ["m.reference_type = 'dispatch'"];
    $params = [];

    if (!empty($_GET['company_id'])) { $where[] = "m.company_id = ?"; $params[] = $_GET['company_id']; }
    if (!empty($_GET['warehouse_id'])) { $where[] = "m.warehouse_id = ?"; $params[] = $_GET['warehouse_id']; }
    if (!empty($_GET['start_date'])) { $where[] = "DATE(m.created_at) >= ?"; $params[] = $_GET['start_date']; }
    if (!empty($_GET['end_date'])) { $where[] = "DATE(m.created_at) <= ?"; $params[] = $_GET['end_date']; }
    if (!empty($_GET['search'])) { $where[] = "(m.reference_doc_number LIKE ? OR m.reference_order_id LIKE ?)"; $params[] = "%{$_GET['search']}%"; $params[] = "%{$_GET['search']}%"; }

    $whereSql = implode(" AND ", $where);

    // Group by batch doc number
    $countSql = "SELECT COUNT(DISTINCT m.reference_doc_number) FROM inv2_movements m WHERE $whereSql";
    $stmt = $pdo->prepare($countSql);
    $stmt->execute($params);
    $total = (int)$stmt->fetchColumn();

    $sql = "SELECT m.reference_doc_number as batch_doc_number,
                   MIN(m.created_at) as dispatch_date,
                   COUNT(*) as movement_count,
                   SUM(m.quantity) as total_quantity,
                   COUNT(DISTINCT m.product_id) as product_count,
                   COUNT(DISTINCT m.warehouse_id) as warehouse_count,
                   CONCAT(u.first_name, ' ', u.last_name) as created_by_name
            FROM inv2_movements m
            LEFT JOIN users u ON m.created_by = u.id
            WHERE $whereSql
            GROUP BY m.reference_doc_number, u.first_name, u.last_name
            ORDER BY MIN(m.created_at) DESC
            LIMIT $pageSize OFFSET $offset";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'data' => $rows,
        'pagination' => ['page' => $page, 'pageSize' => $pageSize, 'total' => $total, 'totalPages' => ceil($total / $pageSize)]
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
