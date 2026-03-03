<?php
// Receive List API — List receive documents
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

    $where = ["1=1"];
    $params = [];

    if (!empty($_GET['company_id'])) { $where[] = "rd.company_id = ?"; $params[] = $_GET['company_id']; }
    if (!empty($_GET['warehouse_id'])) { $where[] = "rd.warehouse_id = ?"; $params[] = $_GET['warehouse_id']; }
    if (!empty($_GET['search'])) { $where[] = "(rd.doc_number LIKE ? OR so.so_number LIKE ?)"; $params[] = "%{$_GET['search']}%"; $params[] = "%{$_GET['search']}%"; }
    if (!empty($_GET['start_date'])) { $where[] = "rd.receive_date >= ?"; $params[] = $_GET['start_date']; }
    if (!empty($_GET['end_date'])) { $where[] = "rd.receive_date <= ?"; $params[] = $_GET['end_date']; }

    $whereSql = implode(" AND ", $where);

    $stmt = $pdo->prepare("SELECT COUNT(*) FROM inv2_receive_documents rd LEFT JOIN inv2_stock_orders so ON rd.stock_order_id = so.id WHERE $whereSql");
    $stmt->execute($params);
    $total = (int)$stmt->fetchColumn();

    $sql = "SELECT rd.*, w.name as warehouse_name, so.so_number,
                   CONCAT(u.first_name, ' ', u.last_name) as created_by_name,
                   (SELECT COUNT(*) FROM inv2_receive_items WHERE receive_doc_id = rd.id) as item_count,
                   (SELECT SUM(quantity) FROM inv2_receive_items WHERE receive_doc_id = rd.id) as total_quantity
            FROM inv2_receive_documents rd
            LEFT JOIN warehouses w ON rd.warehouse_id = w.id
            LEFT JOIN inv2_stock_orders so ON rd.stock_order_id = so.id
            LEFT JOIN users u ON rd.created_by = u.id
            WHERE $whereSql
            ORDER BY rd.receive_date DESC, rd.id DESC
            LIMIT $pageSize OFFSET $offset";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($rows as &$row) {
        $row['images'] = $row['images'] ? json_decode($row['images'], true) : [];
    }

    echo json_encode([
        'success' => true,
        'data' => $rows,
        'pagination' => ['page' => $page, 'pageSize' => $pageSize, 'total' => $total, 'totalPages' => ceil($total / $pageSize)]
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
