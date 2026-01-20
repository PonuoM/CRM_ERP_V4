<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once '../config.php';

$data = json_decode(file_get_contents("php://input"), true);

if (!$data || !isset($data['returns']) || !is_array($data['returns'])) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Invalid input data"]);
    exit;
}

$conn = db_connect();
$conn->beginTransaction();

try {
    $stmt = $conn->prepare("INSERT INTO order_returns (sub_order_id, return_amount, status, note, created_at) VALUES (?, ?, ?, ?, NOW())");
    
    $successCount = 0;
    
    foreach ($data['returns'] as $item) {
        $subOrderId = isset($item['sub_order_id']) ? $item['sub_order_id'] : '';
        $amount = isset($item['return_amount']) ? floatval($item['return_amount']) : 0.00;
        $status = isset($item['status']) ? $item['status'] : 'returned';
        $note = isset($item['note']) ? $item['note'] : '';

        if (empty($subOrderId)) continue; 

        // PDO execution
        if ($stmt->execute([$subOrderId, $amount, $status, $note])) {
            $successCount++;
        }
    }
    
    $conn->commit();
    echo json_encode(["status" => "success", "message" => "Saved $successCount items successfully"]);

} catch (Exception $e) {
    if (isset($conn)) $conn->rollBack();
    error_log("Save Return Orders Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Database error: " . $e->getMessage()]);
}

$conn = null;
?>
