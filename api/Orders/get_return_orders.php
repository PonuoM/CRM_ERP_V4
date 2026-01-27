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
    // Select from order_boxes where return_status is not null
    $sql = "
        SELECT 
            ob.id,
            ob.sub_order_id,
            ob.return_status as status,
            ob.return_note as note,
            ob.return_created_at as created_at,
            -- Try to get tracking number from order_tracking_numbers if possible, or fallback to sub_order_id
            MAX(COALESCE(otn.tracking_number, ob.sub_order_id)) as tracking_number
        FROM order_boxes ob
        LEFT JOIN order_tracking_numbers otn ON 
            ob.sub_order_id = otn.tracking_number 
            OR ob.sub_order_id = otn.parent_order_id
            OR ob.sub_order_id = CONCAT(otn.parent_order_id, '-', otn.box_number)
        WHERE ob.return_status IS NOT NULL
        GROUP BY ob.id
        ORDER BY ob.return_created_at DESC
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