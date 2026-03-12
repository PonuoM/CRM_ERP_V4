<?php
// SO List API — List Stock Orders with filtering & pagination
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

    if (!empty($_GET['company_id'])) {
        $where[] = "so.company_id = ?";
        $params[] = $_GET['company_id'];
    }
    if (!empty($_GET['status'])) {
        $where[] = "so.status = ?";
        $params[] = $_GET['status'];
    }
    if (!empty($_GET['warehouse_id'])) {
        $where[] = "so.warehouse_id = ?";
        $params[] = $_GET['warehouse_id'];
    }
    if (!empty($_GET['search'])) {
        $where[] = "(so.so_number LIKE ? OR so.notes LIKE ? OR so.source_location LIKE ? OR so.customer_vendor LIKE ?)";
        $params[] = "%{$_GET['search']}%";
        $params[] = "%{$_GET['search']}%";
        $params[] = "%{$_GET['search']}%";
        $params[] = "%{$_GET['search']}%";
    }
    if (!empty($_GET['start_date'])) {
        $where[] = "so.order_date >= ?";
        $params[] = $_GET['start_date'];
    }
    if (!empty($_GET['end_date'])) {
        $where[] = "so.order_date <= ?";
        $params[] = $_GET['end_date'];
    }

    $whereSql = implode(" AND ", $where);

    // Count
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM inv2_stock_orders so WHERE $whereSql");
    $stmt->execute($params);
    $total = (int)$stmt->fetchColumn();

    // Fetch
    $sql = "SELECT so.*, w.name as warehouse_name,
                   CONCAT(u.first_name, ' ', u.last_name) as created_by_name,
                   (SELECT COUNT(*) FROM inv2_stock_order_items WHERE stock_order_id = so.id) as item_count
            FROM inv2_stock_orders so
            LEFT JOIN warehouses w ON so.warehouse_id = w.id
            LEFT JOIN users u ON so.created_by = u.id
            WHERE $whereSql
            ORDER BY so.order_date DESC, so.id DESC
            LIMIT $pageSize OFFSET $offset";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Parse images JSON
    foreach ($rows as &$row) {
        $row['images'] = $row['images'] ? json_decode($row['images'], true) : [];
    }

    echo json_encode([
        'success' => true,
        'data' => $rows,
        'pagination' => [
            'page' => $page,
            'pageSize' => $pageSize,
            'total' => $total,
            'totalPages' => ceil($total / $pageSize)
        ]
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
