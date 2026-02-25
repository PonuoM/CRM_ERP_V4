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

$input = json_decode(file_get_contents("php://input"), true);
$statementLogId = isset($input["statement_log_id"]) ? (int) $input["statement_log_id"] : 0;
$codDocumentId = isset($input["cod_document_id"]) ? (int) $input["cod_document_id"] : 0;
$companyId = isset($input["company_id"]) ? (int) $input["company_id"] : 0;

if ($statementLogId <= 0 || $codDocumentId <= 0 || $companyId <= 0) {
    http_response_code(400);
    echo json_encode(["ok" => false, "error" => "Missing required fields: statement_log_id, cod_document_id, company_id"], JSON_UNESCAPED_UNICODE);
    exit();
}

try {
    $pdo = db_connect();
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $pdo->beginTransaction();

    // 1. Check if any reconcile log is confirmed — block unmatch
    $confirmCheck = $pdo->prepare("
    SELECT COUNT(*) FROM statement_reconcile_logs srl
    INNER JOIN statement_reconcile_batches srb ON srb.id = srl.batch_id
    WHERE srl.statement_log_id = :stmtId AND srb.company_id = :companyId
      AND srl.confirmed_action = 'Confirmed'
  ");
    $confirmCheck->execute([':stmtId' => $statementLogId, ':companyId' => $companyId]);
    if ((int) $confirmCheck->fetchColumn() > 0) {
        echo json_encode(["ok" => false, "error" => "ไม่สามารถยกเลิกได้ เนื่องจากรายการนี้ถูกยืนยันแล้ว"], JSON_UNESCAPED_UNICODE);
        exit();
    }

    // 2. Delete all reconcile logs for this statement
    $logsStmt = $pdo->prepare("
    SELECT srl.id, srl.batch_id, srl.order_id, srl.reconcile_type
    FROM statement_reconcile_logs srl
    INNER JOIN statement_reconcile_batches srb ON srb.id = srl.batch_id
    WHERE srl.statement_log_id = :stmtId AND srb.company_id = :companyId
  ");
    $logsStmt->execute([':stmtId' => $statementLogId, ':companyId' => $companyId]);
    $reconcileLogs = $logsStmt->fetchAll(PDO::FETCH_ASSOC);

    $batchIds = [];
    foreach ($reconcileLogs as $log) {
        $batchIds[$log['batch_id']] = true;

        // Revert order payment if it was an Order-type reconciliation
        if ($log['reconcile_type'] === 'Order' && !empty($log['order_id'])) {
            // Delete the log first
            $delLog = $pdo->prepare("DELETE FROM statement_reconcile_logs WHERE id = :id");
            $delLog->execute([':id' => $log['id']]);

            // Recalculate remaining reconciled for this order
            $sumStmt = $pdo->prepare("
        SELECT COALESCE(SUM(srl.confirmed_amount), 0)
        FROM statement_reconcile_logs srl
        INNER JOIN statement_reconcile_batches srb ON srb.id = srl.batch_id
        WHERE srl.order_id = :orderId AND srb.company_id = :companyId
      ");
            $sumStmt->execute([':orderId' => $log['order_id'], ':companyId' => $companyId]);
            $remainingPaid = (float) $sumStmt->fetchColumn();

            $pdo->prepare("UPDATE orders SET amount_paid = :paid WHERE id = :id AND company_id = :cid")
                ->execute([':paid' => $remainingPaid, ':id' => $log['order_id'], ':cid' => $companyId]);
        } else {
            // Non-order type (Suspense, Deposit) — just delete
            $delLog = $pdo->prepare("DELETE FROM statement_reconcile_logs WHERE id = :id");
            $delLog->execute([':id' => $log['id']]);
        }
    }

    // 2. Clean up empty batches
    foreach (array_keys($batchIds) as $batchId) {
        $countStmt = $pdo->prepare("SELECT COUNT(*) FROM statement_reconcile_logs WHERE batch_id = :batchId");
        $countStmt->execute([':batchId' => $batchId]);
        if ((int) $countStmt->fetchColumn() === 0) {
            $pdo->prepare("DELETE FROM statement_reconcile_batches WHERE id = :id")->execute([':id' => $batchId]);
        }
    }

    // 3. Set cod_documents.matched_statement_log_id = NULL
    $codStmt = $pdo->prepare("
    UPDATE cod_documents SET matched_statement_log_id = NULL, status = NULL
    WHERE id = :codId AND company_id = :companyId
  ");
    $codStmt->execute([':codId' => $codDocumentId, ':companyId' => $companyId]);

    $pdo->commit();

    echo json_encode(["ok" => true], JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(["ok" => false, "error" => $e->getMessage()], JSON_UNESCAPED_UNICODE);
}
?>