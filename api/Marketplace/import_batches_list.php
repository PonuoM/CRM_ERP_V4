<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET");

require_once __DIR__ . '/../config.php';

try {
    $conn = db_connect();
    $companyId = $_GET['company_id'] ?? null;

    $where = [];
    $params = [];

    if ($companyId) {
        $where[] = "b.company_id = ?";
        $params[] = $companyId;
    }

    $whereSql = count($where) ? "WHERE " . implode(" AND ", $where) : "";

    $query = "
        SELECT b.*, u.first_name, u.last_name,
            (SELECT SUM(total_price) FROM marketplace_sales_orders WHERE batch_id = b.id) as total_sales,
            (SELECT COUNT(DISTINCT online_order_id) FROM marketplace_sales_orders WHERE batch_id = b.id AND order_status != 'ยกเลิกแล้ว') as active_orders
        FROM marketplace_import_batches b
        LEFT JOIN users u ON u.id = b.user_id
        $whereSql
        ORDER BY b.created_at DESC
        LIMIT 50
    ";

    $stmt = $conn->prepare($query);
    $stmt->execute($params);
    $data = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(["success" => true, "data" => $data]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["success" => false, "error" => $e->getMessage()]);
}
?>
