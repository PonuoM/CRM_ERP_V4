<?php
/**
 * confirm_cod_document.php
 * 
 * Confirms all reconciliation logs for a COD document in a single transaction.
 * This handles COD documents that may have multiple orders (including forced records).
 */

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

    // Required: cod_document_id
    $codDocumentId = isset($input['cod_document_id']) ? (int)$input['cod_document_id'] : 0;
    $companyId = isset($input['company_id']) ? (int)$input['company_id'] : 0;
    $userId = isset($input['user_id']) ? (int)$input['user_id'] : 0;

    if ($codDocumentId <= 0) {
        throw new Exception("Missing or invalid cod_document_id");
    }

    $pdo = db_connect();
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    $pdo->beginTransaction();

    // 1. Validate COD document exists
    $docStmt = $pdo->prepare("
        SELECT cd.id, cd.document_number, cd.matched_statement_log_id, cd.status, cd.verified_at
        FROM cod_documents cd
        WHERE cd.id = :docId
    ");
    $docStmt->execute([':docId' => $codDocumentId]);
    $codDoc = $docStmt->fetch(PDO::FETCH_ASSOC);

    if (!$codDoc) {
        throw new Exception("COD document not found: {$codDocumentId}");
    }

    $statementLogId = $codDoc['matched_statement_log_id'];
    if (!$statementLogId) {
        throw new Exception("COD document is not matched to any statement");
    }

    // 2. Find all statement_reconcile_logs for this statement_log_id
    $logsStmt = $pdo->prepare("
        SELECT srl.id, srl.order_id, srl.confirmed_amount, srl.confirmed_at
        FROM statement_reconcile_logs srl
        WHERE srl.statement_log_id = :statementLogId
    ");
    $logsStmt->execute([':statementLogId' => $statementLogId]);
    $reconcileLogs = $logsStmt->fetchAll(PDO::FETCH_ASSOC);

    if (empty($reconcileLogs)) {
        throw new Exception("No reconciliation logs found for this COD document");
    }

    // 3. Update all reconcile logs to confirmed
    $updateStmt = $pdo->prepare("
        UPDATE statement_reconcile_logs 
        SET confirmed_at = NOW(),
            confirmed_action = 'Confirmed'
        WHERE statement_log_id = :statementLogId
          AND confirmed_at IS NULL
    ");
    $updateStmt->execute([':statementLogId' => $statementLogId]);
    $updatedCount = $updateStmt->rowCount();

    // 4. Update order payment_status to 'Approved' and order_status to 'Delivered'
    // This is the final confirmation step after Bank Audit verification
    $orderIdsUpdated = [];
    foreach ($reconcileLogs as $log) {
        $orderId = $log['order_id'];
        if (!empty($orderId) && !in_array($orderId, $orderIdsUpdated)) {
            // Get parent order id (remove sub-order suffix like -1, -2)
            $parentOrderId = preg_replace('/-\d+$/', '', $orderId);
            
            // Update order to Approved status
            $updateOrderStmt = $pdo->prepare("
                UPDATE orders 
                SET payment_status = 'Approved',
                    order_status = 'Delivered',
                    updated_at = NOW()
                WHERE id = :orderId
                  AND payment_status IN ('PreApproved', 'Pending')
            ");
            $updateOrderStmt->execute([':orderId' => $parentOrderId]);
            $orderIdsUpdated[] = $orderId;
        }
    }

    // 5. Optionally update cod_documents verified_at if not already set
    if (empty($codDoc['verified_at'])) {
        $updateDocStmt = $pdo->prepare("
            UPDATE cod_documents 
            SET verified_at = NOW(),
                verified_by = :userId,
                status = 'verified',
                updated_at = NOW()
            WHERE id = :docId
        ");
        $updateDocStmt->execute([
            ':userId' => $userId > 0 ? $userId : null,
            ':docId' => $codDocumentId
        ]);
    }

    $pdo->commit();

    echo json_encode([
        'ok' => true,
        'message' => 'COD document confirmed successfully',
        'cod_document_id' => $codDocumentId,
        'document_number' => $codDoc['document_number'],
        'updated_logs' => $updatedCount,
        'total_logs' => count($reconcileLogs)
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

} catch (PDOException $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log("confirm_cod_document.php PDOException: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'ok' => false,
        'error' => 'Database error: ' . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log("confirm_cod_document.php Exception: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'ok' => false,
        'error' => $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
?>
