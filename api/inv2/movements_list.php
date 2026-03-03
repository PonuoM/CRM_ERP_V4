<?php
// Movements List API — Full movement history with filters
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

require_once __DIR__ . '/../config.php';
$pdo = db_connect();

try {
    $page = isset($_GET['page']) ? max(1, (int)$_GET['page']) : 1;
    $pageSize = isset($_GET['pageSize']) ? min(200, max(1, (int)$_GET['pageSize'])) : 50;
    $offset = ($page - 1) * $pageSize;

    $where = ["1=1"];
    $params = [];

    if (!empty($_GET['company_id'])) { $where[] = "m.company_id = ?"; $params[] = $_GET['company_id']; }
    if (!empty($_GET['warehouse_id'])) { $where[] = "m.warehouse_id = ?"; $params[] = $_GET['warehouse_id']; }
    if (!empty($_GET['product_id'])) { $where[] = "m.product_id = ?"; $params[] = $_GET['product_id']; }
    if (!empty($_GET['movement_type'])) { $where[] = "m.movement_type = ?"; $params[] = $_GET['movement_type']; }
    if (!empty($_GET['reference_type'])) { $where[] = "m.reference_type = ?"; $params[] = $_GET['reference_type']; }
    if (!empty($_GET['start_date'])) { $where[] = "DATE(m.created_at) >= ?"; $params[] = $_GET['start_date']; }
    if (!empty($_GET['end_date'])) { $where[] = "DATE(m.created_at) <= ?"; $params[] = $_GET['end_date']; }
    if (!empty($_GET['search'])) {
        $where[] = "(m.reference_doc_number LIKE ? OR m.reference_order_id LIKE ? OR m.notes LIKE ? OR p.name LIKE ? OR p.sku LIKE ?)";
        $s = "%{$_GET['search']}%";
        $params = array_merge($params, [$s, $s, $s, $s, $s]);
    }

    $whereSql = implode(" AND ", $where);

    // Count
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM inv2_movements m LEFT JOIN products p ON m.product_id = p.id WHERE $whereSql");
    $stmt->execute($params);
    $total = (int)$stmt->fetchColumn();

    // Fetch
    $sql = "SELECT m.*, w.name as warehouse_name,
                   p.name as product_name, p.sku as product_sku,
                   CONCAT(u.first_name, ' ', u.last_name) as created_by_name
            FROM inv2_movements m
            LEFT JOIN warehouses w ON m.warehouse_id = w.id
            LEFT JOIN products p ON m.product_id = p.id
            LEFT JOIN users u ON m.created_by = u.id
            WHERE $whereSql
            ORDER BY m.created_at DESC, m.id DESC
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
