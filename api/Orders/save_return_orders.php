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
    // We now update order_boxes instead of inserting into order_returns.
    // We match by sub_order_id.

    $stmt = $conn->prepare("UPDATE order_boxes SET return_status = ?, return_note = ?, return_created_at = NOW(), status = 'RETURNED' WHERE sub_order_id = ?");

    $successCount = 0;

    foreach ($data['returns'] as $item) {
        $subOrderId = isset($item['sub_order_id']) ? $item['sub_order_id'] : '';
        $status = isset($item['status']) ? $item['status'] : 'returned';
        $note = isset($item['note']) ? $item['note'] : '';

        if (empty($subOrderId))
            continue;

        // PDO execution
        if ($stmt->execute([$status, $note, $subOrderId])) {
            // Check if any row was actually updated
            if ($stmt->rowCount() > 0) {
                $successCount++;
            } else {
                // FALLBACK: If sub_order_id not found, maybe it's a Main Order ID?
                // Try updating all boxes for this order_id
                $stmtFallback = $conn->prepare("UPDATE order_boxes SET return_status = ?, return_note = ?, return_created_at = NOW(), status = 'RETURNED' WHERE order_id = ?");
                if ($stmtFallback->execute([$status, $note, $subOrderId])) {
                    if ($stmtFallback->rowCount() > 0) {
                        $successCount++;
                    }
                }
            }
        }
    }

    // Update Main Order Status to 'Returned'
    // Extract unique Main Order IDs from successful updates
    // We can infer main order ID from sub_order_id or just use the ones we processed.

    $mainOrderIds = [];
    foreach ($data['returns'] as $item) {
        $subOrderId = isset($item['sub_order_id']) ? $item['sub_order_id'] : '';
        if (empty($subOrderId))
            continue;

        // Extract Main Order ID logic
        $parts = explode('-', $subOrderId);
        if (count($parts) >= 3) {
            array_pop($parts);
            $mainId = implode('-', $parts);
        } else {
            $mainId = $subOrderId;
        }
        $mainOrderIds[] = $mainId;
    }

    $mainOrderIds = array_unique($mainOrderIds);

    if (!empty($mainOrderIds)) {
        $placeholders = str_repeat('?,', count($mainOrderIds) - 1) . '?';
        $updateSql = "UPDATE orders SET order_status = 'Returned' WHERE id IN ($placeholders)";
        $updateStmt = $conn->prepare($updateSql);
        $updateStmt->execute(array_values($mainOrderIds));
    }

    $conn->commit();
    echo json_encode(["status" => "success", "message" => "Saved $successCount items successfully"]);

} catch (Exception $e) {
    if (isset($conn))
        $conn->rollBack();
    error_log("Save Return Orders Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Database error: " . $e->getMessage()]);
}

$conn = null;
?>