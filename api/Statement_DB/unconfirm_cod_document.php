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
 * Unconfirm (undo) a confirmed COD Document
 * - Deletes the reconcile log records
 * - Recalculates amount_paid from remaining reconcile logs for orders
 * - Reverts order_status and payment_status appropriately
 * - Unlinks the statement_log_id from cod_documents and sets status to pending
 */

$input = json_decode(file_get_contents("php://input"), true);
$codDocumentId = isset($input["cod_document_id"]) ? (int) $input["cod_document_id"] : 0;
// Note: Frontend passing statement_log_id and company_id is optional but good, let's also read it just in case
$statementLogId = isset($input["statement_log_id"]) ? (int) $input["statement_log_id"] : 0;
$companyId = isset($input["company_id"]) ? (int) $input["company_id"] : 0;
$userId = isset($input["user_id"]) ? (int) $input["user_id"] : null;

if ($codDocumentId <= 0 || $companyId <= 0) {
    http_response_code(400);
    echo json_encode(["ok" => false, "error" => "Missing cod_document_id or company_id"]);
    exit();
}

try {
    $pdo = db_connect();
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    set_audit_context($pdo, 'statement/unconfirm_cod_document');

    $pdo->beginTransaction();

    // 1. Find the COD doc
    $docStmt = $pdo->prepare("SELECT matched_statement_log_id FROM cod_documents WHERE id = :id AND company_id = :companyId");
    $docStmt->execute([':id' => $codDocumentId, ':companyId' => $companyId]);
    $doc = $docStmt->fetch(PDO::FETCH_ASSOC);

    if (!$doc) {
        throw new Exception("COD Document not found or access denied");
    }

    $stmtLogId = $statementLogId > 0 ? $statementLogId : $doc['matched_statement_log_id'];

    if (!$stmtLogId) {
        throw new Exception("COD document is not matched to any statement");
    }

    // 2. Unconfirm and delete all reconcile logs for this statement log ID
    // Get all reconcile logs linked to this statement log ID
    $logsStmt = $pdo->prepare("
        SELECT srl.id, srl.batch_id, srl.order_id, srl.reconcile_type, srl.confirmed_amount
        FROM statement_reconcile_logs srl
        INNER JOIN statement_reconcile_batches srb ON srb.id = srl.batch_id
        WHERE srl.statement_log_id = :stmtId AND srb.company_id = :companyId
    ");
    $logsStmt->execute([':stmtId' => $stmtLogId, ':companyId' => $companyId]);
    $reconcileLogs = $logsStmt->fetchAll(PDO::FETCH_ASSOC);

    $batchIds = [];
    foreach ($reconcileLogs as $log) {
        $batchIds[$log['batch_id']] = true;
        
        $delLog = $pdo->prepare("DELETE FROM statement_reconcile_logs WHERE id = :id");
        $delLog->execute([':id' => $log['id']]);

        // 3. Revert orders
        if ($log['reconcile_type'] === 'Order' && !empty($log['order_id'])) {
            $orderId = $log['order_id'];
            
            // Recalculate remaining reconciled for this order
            $sumStmt = $pdo->prepare("
                SELECT COALESCE(SUM(srl.confirmed_amount), 0)
                FROM statement_reconcile_logs srl
                INNER JOIN statement_reconcile_batches srb ON srb.id = srl.batch_id
                WHERE srl.order_id = :orderId AND srb.company_id = :companyId
            ");
            $sumStmt->execute([':orderId' => $orderId, ':companyId' => $companyId]);
            $remainingPaid = (float) $sumStmt->fetchColumn();

            // Cap at 1.5x total_amount to prevent doubling bugs (allows normal overpayments)
            $orderTotalStmt = $pdo->prepare("SELECT id, total_amount, order_status, payment_status FROM orders WHERE id = :id AND company_id = :cid");
            $orderTotalStmt->execute([':id' => $orderId, ':cid' => $companyId]);
            $order = $orderTotalStmt->fetch(PDO::FETCH_ASSOC);

            if ($order) {
                $totalAmount = (float) $order['total_amount'];
                if ($totalAmount > 0 && $remainingPaid > $totalAmount * 1.5) {
                    $remainingPaid = $totalAmount;
                }

                $currentOrderStatus = $order['order_status'];
                $currentPaymentStatus = $order['payment_status'];

                // Smart status revert: Revert payment_status to 'PreApproved' (รอบัญชีตรวจสอบ)
                // only if we unconfirm. DO NOT set to Unpaid if money was collected.
                if ($remainingPaid >= $totalAmount - 0.01) {
                    $newPaymentStatus = $currentPaymentStatus;
                    $newOrderStatus = $currentOrderStatus;
                } else {
                    $newPaymentStatus = 'PreApproved';
                    // Revert from Delivered (เสร็จสิ้น) back to PreApproved (รอบัญชีตรวจสอบ)
                    $newOrderStatus = ($currentOrderStatus === 'Delivered') ? 'PreApproved' : $currentOrderStatus;
                }
                
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
    }

    // 4. Clean up empty batches
    foreach (array_keys($batchIds) as $batchId) {
        $countStmt = $pdo->prepare("SELECT COUNT(*) FROM statement_reconcile_logs WHERE batch_id = :batchId");
        $countStmt->execute([':batchId' => $batchId]);
        if ((int) $countStmt->fetchColumn() === 0) {
            $pdo->prepare("DELETE FROM statement_reconcile_batches WHERE id = :id")->execute([':id' => $batchId]);
        }
    }

    // 5. Update the cod_document to unmatch and unverify 
    // "ถอยเอกสาร COD ออกจากสเตรทเม้นให้หน่อย เนื่องจากจะมีการแก้ไข" implies complete removal of matching link
    $codUpdate = $pdo->prepare("
        UPDATE cod_documents 
        SET matched_statement_log_id = NULL,
            status = 'pending',
            verified_at = NULL,
            verified_by = NULL
        WHERE id = :codId AND company_id = :companyId
    ");
    $codUpdate->execute([':codId' => $codDocumentId, ':companyId' => $companyId]);

    $pdo->commit();

    echo json_encode([
        "ok" => true, 
        "message" => "ถอยยอดเงินและปลดล็อคเอกสาร COD สำเร็จ"
    ], JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(["ok" => false, "error" => $e->getMessage()], JSON_UNESCAPED_UNICODE);
}
?>
