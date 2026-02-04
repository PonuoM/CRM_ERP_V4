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

header('Content-Type: application/json');

require_once '../config.php';

$conn = db_connect();

try {
    // Select from order_returns table
    $sql = "
        SELECT 
            ort.id,
            COALESCE(CONCAT(otn.parent_order_id, '-', otn.box_number), otn.order_id) as sub_order_id,
            ort.tracking_number,
            ort.status,
            ort.note,
            ort.created_at,
            ort.updated_at,
            0 as return_amount,
            o.total_amount,
            o.order_date,
            o.id as main_order_id
        FROM order_returns ort
        LEFT JOIN order_tracking_numbers otn ON ort.tracking_number = otn.tracking_number
        LEFT JOIN orders o ON o.id = otn.parent_order_id OR o.id = otn.order_id 
        GROUP BY ort.id
        ORDER BY ort.updated_at DESC
    ";

    $stmt = $conn->prepare($sql);
    $stmt->execute();
    $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(["status" => "success", "data" => $results]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Database error: " . $e->getMessage()]);
}

$conn = null;
?>