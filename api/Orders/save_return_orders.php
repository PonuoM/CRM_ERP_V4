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
    $stmt = $conn->prepare("INSERT INTO order_returns (sub_order_id, status, note, created_at) VALUES (?, ?, ?, NOW()) 
    ON DUPLICATE KEY UPDATE status = VALUES(status), note = VALUES(note), created_at = NOW()");
    
    $successCount = 0;
    
    foreach ($data['returns'] as $item) {
        $subOrderId = isset($item['sub_order_id']) ? $item['sub_order_id'] : '';
        $status = isset($item['status']) ? $item['status'] : 'returned';
        $note = isset($item['note']) ? $item['note'] : '';

        if (empty($subOrderId)) continue; 

        // PDO execution
        if ($stmt->execute([$subOrderId, $status, $note])) {
            $successCount++;
        }
    }
    
    // Update Main Order Status to 'Returned'
    // Extract unique Main Order IDs from successful insertions
    $mainOrderIds = [];
    foreach ($data['returns'] as $item) {
        $subOrderId = isset($item['sub_order_id']) ? $item['sub_order_id'] : '';
        if (empty($subOrderId)) continue;
        
        // Extract Main Order ID (Assume Format: {MainID}-{BoxNum} or just {MainID})
        // Simple logic: Take string before the last hyphen, OR if no hyphen, take whole string.
        // BUT, our Main IDs also have hyphens (e.g. 241225-0001).
        // AND Box IDs are like 241225-0001-1.
        // So we need to check if the ID exists in `orders` table.
        // Strategy: 
        // 1. Try whole ID.
        // 2. If length > some reasonable main ID length, try stripping last segment.
        
        // Actually, valid Main IDs are usually fixed format. 
        // Let's rely on checking the DB or simple heuristic.
        // Heuristic: If it has 2 hyphens (YYMMDD-XXXX-Y), it's a sub order. If 1 (YYMMDD-XXXX), it's main.
        // Let's implement a check.
        
        $parts = explode('-', $subOrderId);
        if (count($parts) >= 3) {
            // Likely sub order, remove last part
            array_pop($parts);
            $mainId = implode('-', $parts);
        } else {
            $mainId = $subOrderId;
        }
        $mainOrderIds[] = $mainId;
    }
    
    $mainOrderIds = array_unique($mainOrderIds);

    if (!empty($mainOrderIds)) {
        // We only update to 'Returned' if the user requested it. 
        // (User request: "Besides adding to order_returns, update orders table status to 'Returned'")
        // We assume this applies effectively to all orders processed here.
        
        $placeholders = str_repeat('?,', count($mainOrderIds) - 1) . '?';
        $updateSql = "UPDATE orders SET order_status = 'Returned' WHERE id IN ($placeholders)";
        $updateStmt = $conn->prepare($updateSql);
        $updateStmt->execute(array_values($mainOrderIds));
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
