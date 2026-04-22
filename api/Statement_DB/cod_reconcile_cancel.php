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
// Expect statement_log_id to find the matched cod_documents
$statementLogId = $input["statement_log_id"] ?? null; 
$companyId = $input["company_id"] ?? null;

if (!$statementLogId || !$companyId) {
    http_response_code(400);
    echo json_encode(["ok" => false, "error" => "Missing statement_log_id or company_id"]);
    exit();
}

try {
    $pdo = db_connect();
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // 1. Find the COD document matched to this statement
    $stmt = $pdo->prepare("
        SELECT id, document_number 
        FROM cod_documents 
        WHERE matched_statement_log_id = :stmtId AND company_id = :companyId
    ");
    $stmt->execute([':stmtId' => $statementLogId, ':companyId' => $companyId]);
    $codDoc = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$codDoc) {
        throw new Exception("COD Document not found for this statement or access denied.");
    }

    $codDocumentId = $codDoc['id'];

    // 2. Find the statement batch associated with this COD matching 
    // cod_reconcile_save.php saves it with notes "COD Document: {document_number}"
    // or we can find it via the reconcile logs that point to statementLogId
    $batchStmt = $pdo->prepare("
        SELECT DISTINCT batch_id 
        FROM statement_reconcile_logs 
        WHERE statement_log_id = :stmtId
    ");
    $batchStmt->execute([':stmtId' => $statementLogId]);
    $batches = $batchStmt->fetchAll(PDO::FETCH_COLUMN);

    $pdo->beginTransaction();

    // 3. Revert each order's amount_paid that was matched in this batch
    if (!empty($batches)) {
        $placeholders = implode(',', array_fill(0, count($batches), '?'));
        
        $logsStmt = $pdo->prepare("
            SELECT id, order_id, confirmed_amount 
            FROM statement_reconcile_logs 
            WHERE batch_id IN ($placeholders)
        ");
        $logsStmt->execute($batches);
        $logs = $logsStmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($logs as $log) {
            $orderId = $log['order_id'];
            if (!$orderId) continue;
            
            // Revert orders.amount_paid
            $orderUpdateStmt = $pdo->prepare("
                UPDATE orders 
                SET amount_paid = GREATEST(0, COALESCE(amount_paid, 0) - :amount),
                    payment_status = 'Pending'
                WHERE id = :orderId AND company_id = :companyId
            ");
            $orderUpdateStmt->execute([
                ':amount' => (float)$log['confirmed_amount'],
                ':orderId' => $orderId,
                ':companyId' => $companyId
            ]);
        }
        
        // 4. Delete the reconcile logs and batches
        $delLogsStmt = $pdo->prepare("DELETE FROM statement_reconcile_logs WHERE batch_id IN ($placeholders)");
        $delLogsStmt->execute($batches);

        $delBatchStmt = $pdo->prepare("DELETE FROM statement_reconcile_batches WHERE id IN ($placeholders)");
        $delBatchStmt->execute($batches);
    }

    // 5. Update COD records back to pending
    $updateRecordsStmt = $pdo->prepare("
        UPDATE cod_records 
        SET status = 'pending', updated_at = NOW() 
        WHERE document_id = :docId
    ");
    $updateRecordsStmt->execute([':docId' => $codDocumentId]);

    // 6. Release the COD document
    $updateDocStmt = $pdo->prepare("
        UPDATE cod_documents 
        SET matched_statement_log_id = NULL,
            status = 'pending',
            verified_at = NULL,
            verified_by = NULL
        WHERE id = :docId
    ");
    $updateDocStmt->execute([':docId' => $codDocumentId]);

    $pdo->commit();

    echo json_encode(["ok" => true]);

} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(["ok" => false, "error" => $e->getMessage()]);
}
?>
