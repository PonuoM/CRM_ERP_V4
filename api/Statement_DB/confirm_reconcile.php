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
    $userId = isset($input['user_id']) ? (int) $input['user_id'] : null;
    $orderId = $input['order_id'] ?? null;
    $orderAmount = isset($input['order_amount']) ? (float) $input['order_amount'] : null;
    $paymentMethod = $input['payment_method'] ?? null;

    $pdo = db_connect();
    set_audit_context($pdo, 'statement/confirm_reconcile');

    // Get the current order_id from the reconcile log (don't trust frontend's comma-separated value)
    $logStmt = $pdo->prepare("SELECT order_id FROM statement_reconcile_logs WHERE id = :id");
    $logStmt->execute([':id' => $id]);
    $logRow = $logStmt->fetch(PDO::FETCH_ASSOC);
    if (!$logRow) {
        throw new Exception("Reconcile log not found: {$id}");
    }
    $existingOrderId = $logRow['order_id'];

    // Fallback: if payment_method is null, look it up from the orders table
    if (empty($paymentMethod) && !empty($existingOrderId)) {
        $pmStmt = $pdo->prepare("SELECT payment_method FROM orders WHERE id = :id LIMIT 1");
        $pmStmt->execute([':id' => preg_replace('/-\d+$/', '', $existingOrderId)]);
        $pmRow = $pmStmt->fetch(PDO::FETCH_ASSOC);
        if ($pmRow) {
            $paymentMethod = $pmRow['payment_method'];
        }
    }

    // Update with snapshot — do NOT update order_id (it's already correct from INSERT)
    $sql = "UPDATE statement_reconcile_logs 
            SET confirmed_at = NOW(),
                confirmed_action = 'Confirmed',
                confirmed_by = :confirmedBy,
                confirmed_order_id = :confirmedOrderId,
                confirmed_order_amount = :orderAmount,
                confirmed_payment_method = :paymentMethod
            WHERE id = :id";

    $stmt = $pdo->prepare($sql);
    $result = $stmt->execute([
        ':confirmedBy' => $userId,
        ':confirmedOrderId' => $existingOrderId,
        ':orderAmount' => $orderAmount,
        ':paymentMethod' => $paymentMethod,
        ':id' => $id
    ]);

    if ($result) {
        // Update order status to Delivered (final confirmation after Bank Audit)
        if (!empty($existingOrderId)) {
            // Get parent order id (remove sub-order suffix like -1, -2)
            $parentOrderId = preg_replace('/-\d+$/', '', $existingOrderId);

            // GUARD: Check if order has tracking (already shipped) before setting Delivered
            $trackingCheckStmt = $pdo->prepare(
                "SELECT COUNT(*) FROM order_tracking_numbers WHERE parent_order_id = :orderId"
            );
            $trackingCheckStmt->execute([':orderId' => $parentOrderId]);
            $hasTracking = (int) $trackingCheckStmt->fetchColumn() > 0;

            if ($hasTracking) {
                $updateOrderStmt = $pdo->prepare("
                    UPDATE orders 
                    SET payment_status = 'Approved',
                        order_status = 'Delivered'
                    WHERE id = :orderId
                      AND order_status NOT IN ('Cancelled', 'Returned')
                ");
            } else {
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