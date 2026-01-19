<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once '../config.php';

$conn = db_connect();

try {
    // Join with orders to get details
    // We select relevant columns for display
    $sql = "
        SELECT 
            wr.id,
            wr.order_id,
            wr.return_amount,
            wr.note,
            wr.created_at,
            o.order_date,
            o.total_amount,
            o.customer_id
        FROM order_returns wr
        LEFT JOIN orders o ON wr.order_id = o.id
        ORDER BY wr.created_at DESC
    ";

    $stmt = $conn->prepare($sql);
    $stmt->execute();
    $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Should we fetch customer info? 
    // ReturnManagementPage already has orders with customer info. 
    // But Verified list might refer to old orders not in current 'Returned' list?
    // Let's assume we might need to fetch customer info if we want to display it independent of the 'orders' state.
    // For now, returning basic join data. ReturnManagementPage can likely match with its loaded 'orders' or we can enrich here.
    // Let's just return what we have. Frontend can match 'o.customer_id' to known customers if needed, or we can LEFT JOIN customers too.

    echo json_encode(["status" => "success", "data" => $results]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Database error: " . $e->getMessage()]);
}

$conn = null;
?>
