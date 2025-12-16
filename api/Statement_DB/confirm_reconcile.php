<?php
header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(204);
    exit();
}

require_once __DIR__ . "/../config.php";

try {
    $input = json_decode(file_get_contents("php://input"), true);

    if (empty($input['id'])) {
        throw new Exception("Missing reconcile log ID");
    }

    $id = (int)$input['id'];
    $orderId = $input['order_id'] ?? null;
    $orderAmount = isset($input['order_amount']) ? (float)$input['order_amount'] : null;
    $paymentMethod = $input['payment_method'] ?? null;

    // Check if the record exists and is not already confirmed? 
    // Usually valid to re-confirm or confirm for the first time.

    $pdo = db_connect();

    // Update with snapshot
    $sql = "UPDATE statement_reconcile_logs 
            SET confirmed_at = NOW(),
                confirmed_action = 'Confirmed',
                order_id = :orderId,
                confirmed_order_id = :confirmedOrderId,
                confirmed_order_amount = :orderAmount,
                confirmed_payment_method = :paymentMethod
            WHERE id = :id";
    
    $stmt = $pdo->prepare($sql);
    $result = $stmt->execute([
        ':orderId' => $orderId,
        ':confirmedOrderId' => $orderId,
        ':orderAmount' => $orderAmount,
        ':paymentMethod' => $paymentMethod,
        ':id' => $id
    ]);

    if ($result) {
        echo json_encode(['ok' => true, 'message' => 'Confirmed successfully']);
    } else {
        throw new Exception("Failed to update database");
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
}
?>
