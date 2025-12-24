<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once '../config.php';
$pdo = db_connect();

try {
    $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
    $pageSize = isset($_GET['pageSize']) ? (int)$_GET['pageSize'] : 20;
    $type = isset($_GET['type']) ? $_GET['type'] : ''; // 'receive', 'adjustment', or empty for all
    $search = isset($_GET['search']) ? $_GET['search'] : '';
    
    $offset = ($page - 1) * $pageSize;

    $whereClauses = ["1=1"];
    $params = [];

    if (!empty($type)) {
        $whereClauses[] = "st.type = ?";
        $params[] = $type;
    }

    if (!empty($search)) {
        $whereClauses[] = "(st.document_number LIKE ? OR st.notes LIKE ?)";
        $params[] = "%$search%";
        $params[] = "%$search%";
    }

    // Date Filters (Month/Year)
    if (isset($_GET['month']) && isset($_GET['year'])) {
        $whereClauses[] = "MONTH(st.transaction_date) = ? AND YEAR(st.transaction_date) = ?";
        $params[] = $_GET['month'];
        $params[] = $_GET['year'];
    }

    $whereSql = implode(" AND ", $whereClauses);

    // Count total
    $countSql = "SELECT COUNT(*) FROM stock_transactions st WHERE $whereSql";
    $stmt = $pdo->prepare($countSql);
    $stmt->execute($params);
    $total = $stmt->fetchColumn();

    // Fetch data
    $sql = "SELECT st.*, 
            u.username as created_by_name,
            (SELECT COUNT(*) FROM stock_transaction_items sti WHERE sti.transaction_id = st.id) as item_count,
            (SELECT SUM(quantity) FROM stock_transaction_items sti WHERE sti.transaction_id = st.id) as total_quantity
            FROM stock_transactions st
            LEFT JOIN users u ON st.created_by = u.id
            WHERE $whereSql
            ORDER BY st.transaction_date DESC, st.id DESC
            LIMIT $pageSize OFFSET $offset";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $transactions = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'data' => $transactions,
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
