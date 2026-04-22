<?php
header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(204);
    exit();
}

require_once dirname(__DIR__) . "/config.php";

/**
 * Unconfirm (undo) a confirmed reconcile log
 * - Deletes the reconcile log record
 * - Recalculates amount_paid from remaining reconcile logs
 * - Smart status revert:
 *   - If remaining >= total_amount → keep Approved/Delivered
 *   - If remaining < total_amount → revert to PreApproved/Confirmed
 */

$input = json_decode(file_get_contents("php://input"), true);
$id = $input["id"] ?? null;           // reconcile_log_id
$companyId = $input["company_id"] ?? null;
$userId = $input["user_id"] ?? null;

if (!$id || !$companyId) {
    http_response_code(400);
    echo json_encode(["ok" => false, "error" => "Missing id or company_id"]);
    exit();
}

try {
    $pdo = db_connect();
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    set_audit_context($pdo, 'statement/unconfirm_reconcile');

    // 1. Fetch the reconcile log details
    $stmt = $pdo->prepare("
        SELECT srl.id, srl.order_id, srl.batch_id, srl.reconcile_type,
               srl.confirmed_amount, srl.confirmed_at,
               srb.company_id
        FROM statement_reconcile_logs srl
        INNER JOIN statement_reconcile_batches srb ON srb.id = srl.batch_id
        WHERE srl.id = :id AND srb.company_id = :companyId
    ");
    $stmt->execute([':id' => $id, ':companyId' => $companyId]);
    $logRow = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$logRow) {
        throw new Exception("Record not found or access denied");
    }

    if (!$logRow['confirmed_at']) {
        throw new Exception("Record is not confirmed — use reconcile_cancel instead");
    }

    $orderId = $logRow['order_id'];
    $batchId = $logRow['batch_id'];
    $reconcileType = $logRow['reconcile_type'];

    $pdo->beginTransaction();

    // 2. Delete the reconcile log
    $delStmt = $pdo->prepare("DELETE FROM statement_reconcile_logs WHERE id = :id");
    $delStmt->execute([':id' => $id]);

    // 3. Revert order if this was an Order-type reconciliation
    if ($reconcileType === 'Order' && $orderId) {
        // Recalculate remaining reconciled amount
        $sumStmt = $pdo->prepare("
            SELECT COALESCE(SUM(srl.confirmed_amount), 0) AS total_reconciled
            FROM statement_reconcile_logs srl
            INNER JOIN statement_reconcile_batches srb ON srb.id = srl.batch_id
            WHERE srl.order_id = :orderId AND srb.company_id = :companyId
        ");
        $sumStmt->execute([':orderId' => $orderId, ':companyId' => $companyId]);
        $remainingPaid = (float) $sumStmt->fetchColumn();

        // Get order details
        $orderStmt = $pdo->prepare("
            SELECT id, total_amount, order_status, payment_status
            FROM orders
            WHERE id = :id AND company_id = :companyId
        ");
        $orderStmt->execute([':id' => $orderId, ':companyId' => $companyId]);
        $order = $orderStmt->fetch(PDO::FETCH_ASSOC);

        if ($order) {
            $totalAmount = (float) $order['total_amount'];
            $currentOrderStatus = $order['order_status'];
            $currentPaymentStatus = $order['payment_status'];

            // Smart status revert
            if ($remainingPaid >= $totalAmount - 0.01) {
                // Still fully covered → keep status as-is
                $newOrderStatus = $currentOrderStatus;
                $newPaymentStatus = $currentPaymentStatus;
            } else {
                // Revert to PreApproved
                $newPaymentStatus = 'PreApproved';
                // Revert from Delivered (เสร็จสิ้น) back to PreApproved (รอบัญชีตรวจสอบ)
                $newOrderStatus = ($currentOrderStatus === 'Delivered') ? 'PreApproved' : $currentOrderStatus;
            }

            // Don't revert cancelled/returned orders
            if (!in_array($currentOrderStatus, ['Cancelled', 'Returned'])) {
                $updateStmt = $pdo->prepare("
                    UPDATE orders
                    SET payment_status = :paymentStatus,
                        order_status = :orderStatus
                    WHERE id = :orderId AND company_id = :companyId
                ");
                $updateStmt->execute([
                    ':paymentStatus' => $newPaymentStatus,
                    ':orderStatus' => $newOrderStatus,
                    ':orderId' => $orderId,
                    ':companyId' => $companyId,
                ]);
            }
        }
    }

    // 4. Clean up empty batch
    $countStmt = $pdo->prepare("SELECT COUNT(*) FROM statement_reconcile_logs WHERE batch_id = :batchId");
    $countStmt->execute([':batchId' => $batchId]);
    $remaining = (int) $countStmt->fetchColumn();
    if ($remaining === 0) {
        $delBatch = $pdo->prepare("DELETE FROM statement_reconcile_batches WHERE id = :batchId");
        $delBatch->execute([':batchId' => $batchId]);
    }

    $pdo->commit();

    echo json_encode(["ok" => true, "message" => "Unconfirmed successfully", "remaining_paid" => $remainingPaid ?? null]);

} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(["ok" => false, "error" => $e->getMessage()], JSON_UNESCAPED_UNICODE);
}
?>
