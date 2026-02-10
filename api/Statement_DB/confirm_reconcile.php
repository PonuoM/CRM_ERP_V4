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

    $id = (int) $input['id'];
    $orderId = $input['order_id'] ?? null;
    $orderAmount = isset($input['order_amount']) ? (float) $input['order_amount'] : null;
    $paymentMethod = $input['payment_method'] ?? null;

    $pdo = db_connect();

    // Fallback: if payment_method is null, look it up from the orders table
    if (empty($paymentMethod) && !empty($orderId)) {
        $pmStmt = $pdo->prepare("SELECT payment_method FROM orders WHERE id = :id LIMIT 1");
        $pmStmt->execute([':id' => preg_replace('/-\d+$/', '', $orderId)]);
        $pmRow = $pmStmt->fetch(PDO::FETCH_ASSOC);
        if ($pmRow) {
            $paymentMethod = $pmRow['payment_method'];
        }
    }

    // Check if the record exists and is not already confirmed? 
    // Usually valid to re-confirm or confirm for the first time.

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
        // Update order status to Delivered (final confirmation after Bank Audit)
        if (!empty($orderId)) {
            // Get parent order id (remove sub-order suffix like -1, -2)
            $parentOrderId = preg_replace('/-\d+$/', '', $orderId);

            // GUARD: Check if order has tracking (already shipped) before setting Delivered
            $trackingCheckStmt = $pdo->prepare(
                "SELECT COUNT(*) FROM order_tracking_numbers WHERE parent_order_id = :orderId"
            );
            $trackingCheckStmt->execute([':orderId' => $parentOrderId]);
            $hasTracking = (int) $trackingCheckStmt->fetchColumn() > 0;

            if ($hasTracking) {
                // Has tracking = already shipped → safe to set Delivered
                $updateOrderStmt = $pdo->prepare("
                    UPDATE orders 
                    SET payment_status = 'Approved',
                        order_status = 'Delivered'
                    WHERE id = :orderId
                      AND order_status NOT IN ('Cancelled', 'Returned')
                ");
            } else {
                // No tracking = not shipped yet → only update payment_status
                // order_status will be set to Delivered when tracking is added (auto-complete in index.php)
                $updateOrderStmt = $pdo->prepare("
                    UPDATE orders 
                    SET payment_status = 'Approved'
                    WHERE id = :orderId
                      AND order_status NOT IN ('Cancelled', 'Returned')
                ");
            }
            $updateOrderStmt->execute([':orderId' => $parentOrderId]);
        }

        echo json_encode(['ok' => true, 'message' => 'Confirmed successfully']);
    } else {
        throw new Exception("Failed to update database");
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
}
?>