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

register_shutdown_function(function () {
    $error = error_get_last();
    if ($error !== null && $error['type'] === E_ERROR) {
        file_put_contents(__DIR__ . "/debug_cancel.txt", "FATAL ERROR: " . print_r($error, true) . "\n", FILE_APPEND);
    }
});

file_put_contents(__DIR__ . "/debug_cancel.txt", "Start Cancel " . date("Y-m-d H:i:s") . "\n", FILE_APPEND);

$input = json_decode(file_get_contents("php://input"), true);
$id = $input["id"] ?? null; // reconcile_id
$companyId = $input["company_id"] ?? null;

if (!$id || !$companyId) {
    http_response_code(400);
    echo json_encode(["ok" => false, "error" => "Missing id or company_id"]);
    exit();
}

try {
    $pdo = db_connect();
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // Fetch the reconcile log details before deleting (need order_id, batch_id, reconcile_type)
    $stmt = $pdo->prepare("
        SELECT srl.id, srl.order_id, srl.batch_id, srl.reconcile_type,
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

    $orderId = $logRow['order_id'];
    $batchId = $logRow['batch_id'];
    $reconcileType = $logRow['reconcile_type'];

    $pdo->beginTransaction();

    // 1. Delete the reconcile log
    $delStmt = $pdo->prepare("DELETE FROM statement_reconcile_logs WHERE id = :id");
    $delStmt->execute([':id' => $id]);

    // 2. Revert order if this was an Order-type reconciliation
    if ($reconcileType === 'Order' && $orderId) {
        // Recalculate remaining reconciled amount for this order
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

            // Determine new order_status (payment_status is NOT reverted)
            $earlyFulfillmentStages = ['Pending', 'Picking', 'Preparing'];
            if (in_array($currentOrderStatus, $earlyFulfillmentStages, true)) {
                $newOrderStatus = $currentOrderStatus; // Keep as-is
            } elseif ($remainingPaid <= 0 && in_array($currentOrderStatus, ['PreApproved', 'Delivered'])) {
                $newOrderStatus = 'Confirmed';
            } else {
                $newOrderStatus = $currentOrderStatus;
            }

            $updateStmt = $pdo->prepare("
                UPDATE orders
                SET amount_paid = :amountPaid,
                    order_status = :orderStatus
                WHERE id = :orderId AND company_id = :companyId
            ");
            $updateStmt->execute([
                ':amountPaid' => $remainingPaid,
                ':orderStatus' => $newOrderStatus,
                ':orderId' => $orderId,
                ':companyId' => $companyId,
            ]);
        }
    }

    // 3. Clean up empty batch (if no logs reference it anymore)
    $countStmt = $pdo->prepare("SELECT COUNT(*) FROM statement_reconcile_logs WHERE batch_id = :batchId");
    $countStmt->execute([':batchId' => $batchId]);
    $remaining = (int) $countStmt->fetchColumn();
    if ($remaining === 0) {
        $delBatch = $pdo->prepare("DELETE FROM statement_reconcile_batches WHERE id = :batchId");
        $delBatch->execute([':batchId' => $batchId]);
    }

    $pdo->commit();

    echo json_encode(["ok" => true]);

} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    file_put_contents(__DIR__ . "/debug_cancel.txt", "Exception: " . $e->getMessage() . "\n", FILE_APPEND);
    echo json_encode(["ok" => false, "error" => $e->getMessage()]);
}
?>