<?php
// Dispatch List API — List dispatch batches from inv2_dispatch_batches
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

    if (!empty($_GET['company_id'])) { $where[] = "b.company_id = ?"; $params[] = $_GET['company_id']; }
    if (!empty($_GET['search'])) {
        $where[] = "(b.batch_doc_number LIKE ? OR b.filename LIKE ? OR b.notes LIKE ?)";
        $s = "%{$_GET['search']}%";
        $params[] = $s; $params[] = $s; $params[] = $s;
    }

    $whereSql = implode(" AND ", $where);

    $countSql = "SELECT COUNT(*) FROM inv2_dispatch_batches b WHERE $whereSql";
    $stmt = $pdo->prepare($countSql);
    $stmt->execute($params);
    $total = (int)$stmt->fetchColumn();

    $sql = "SELECT b.*, CONCAT(u.first_name, ' ', u.last_name) as created_by_name
            FROM inv2_dispatch_batches b
            LEFT JOIN users u ON b.created_by = u.id
            WHERE $whereSql
            ORDER BY b.created_at DESC
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
