<?php
/**
 * Script สำหรับลบข้อมูลการ reconcile COD document JAT-261125-1535 กับ Statement #103
 * รัน script นี้เพื่อ reset ข้อมูลให้สามารถทดสอบใหม่ได้
 * 
 * Usage: php reset_cod_reconcile.php
 * หรือเรียกผ่าน browser: http://localhost/api/Statement_DB/reset_cod_reconcile.php
 */

header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");

// Support both web and CLI execution
if (php_sapi_name() === 'cli') {
    require_once __DIR__ . "/../config.php";
} else {
    require_once "../config.php";
}

$documentNumber = 'JAT-261125-1535';
$statementLogId = 103;

try {
    $pdo = db_connect();
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    $pdo->beginTransaction();
    
    $results = [];
    
    // 1. ลบ statement_reconcile_logs ที่เชื่อมกับ statement 103
    $deleteLogsStmt = $pdo->prepare("
        DELETE srl FROM statement_reconcile_logs srl
        INNER JOIN statement_reconcile_batches srb ON srb.id = srl.batch_id
        WHERE srl.statement_log_id = :stmtId
          AND srb.notes LIKE :notesPattern
    ");
    $deleteLogsStmt->execute([
        ':stmtId' => $statementLogId,
        ':notesPattern' => '%' . $documentNumber . '%'
    ]);
    $deletedLogs = $deleteLogsStmt->rowCount();
    $results['deleted_reconcile_logs'] = $deletedLogs;
    
    // 2. ลบ statement_reconcile_batches ที่เกี่ยวข้อง (ถ้ายังมี logs อยู่จะลบไม่ได้)
    $deleteBatchesStmt = $pdo->prepare("
        DELETE srb FROM statement_reconcile_batches srb
        WHERE srb.notes LIKE :notesPattern
          AND NOT EXISTS (
            SELECT 1 FROM statement_reconcile_logs srl WHERE srl.batch_id = srb.id
          )
    ");
    $deleteBatchesStmt->execute([
        ':notesPattern' => '%' . $documentNumber . '%'
    ]);
    $deletedBatches = $deleteBatchesStmt->rowCount();
    $results['deleted_reconcile_batches'] = $deletedBatches;
    
    // 3. Reset cod_documents กลับเป็น pending
    $updateDocStmt = $pdo->prepare("
        UPDATE cod_documents 
        SET status = 'pending', 
            matched_statement_log_id = NULL, 
            verified_by = NULL, 
            verified_at = NULL,
            updated_at = NOW()
        WHERE document_number = :docNumber
    ");
    $updateDocStmt->execute([':docNumber' => $documentNumber]);
    $updatedDocs = $updateDocStmt->rowCount();
    $results['updated_cod_documents'] = $updatedDocs;
    
    // 4. Reset cod_records กลับเป็น pending
    $updateRecordsStmt = $pdo->prepare("
        UPDATE cod_records 
        SET status = 'pending',
            updated_at = NOW()
        WHERE document_id = (SELECT id FROM cod_documents WHERE document_number = :docNumber)
    ");
    $updateRecordsStmt->execute([':docNumber' => $documentNumber]);
    $updatedRecords = $updateRecordsStmt->rowCount();
    $results['updated_cod_records'] = $updatedRecords;
    
    $pdo->commit();
    
    // ตรวจสอบผลลัพธ์
    $checkDocStmt = $pdo->prepare("
        SELECT id, document_number, status, matched_statement_log_id, verified_by, verified_at 
        FROM cod_documents 
        WHERE document_number = :docNumber
    ");
    $checkDocStmt->execute([':docNumber' => $documentNumber]);
    $results['cod_document'] = $checkDocStmt->fetch(PDO::FETCH_ASSOC);
    
    $checkRecordsStmt = $pdo->prepare("
        SELECT cr.id, cr.tracking_number, cr.order_id, cr.status 
        FROM cod_records cr
        INNER JOIN cod_documents cd ON cd.id = cr.document_id
        WHERE cd.document_number = :docNumber
    ");
    $checkRecordsStmt->execute([':docNumber' => $documentNumber]);
    $results['cod_records'] = $checkRecordsStmt->fetchAll(PDO::FETCH_ASSOC);
    
    $checkLogsStmt = $pdo->prepare("
        SELECT srl.*, srb.document_no 
        FROM statement_reconcile_logs srl 
        INNER JOIN statement_reconcile_batches srb ON srb.id = srl.batch_id 
        WHERE srl.statement_log_id = :stmtId
    ");
    $checkLogsStmt->execute([':stmtId' => $statementLogId]);
    $results['remaining_reconcile_logs'] = $checkLogsStmt->fetchAll(PDO::FETCH_ASSOC);
    
    $checkBatchesStmt = $pdo->prepare("
        SELECT srb.* 
        FROM statement_reconcile_batches srb 
        WHERE srb.notes LIKE :notesPattern
    ");
    $checkBatchesStmt->execute([':notesPattern' => '%' . $documentNumber . '%']);
    $results['remaining_reconcile_batches'] = $checkBatchesStmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'ok' => true,
        'message' => 'Reset completed successfully',
        'results' => $results
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    
} catch (Exception $e) {
    if ($pdo && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    
    http_response_code(500);
    echo json_encode([
        'ok' => false,
        'error' => $e->getMessage(),
        'trace' => $e->getTraceAsString()
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
}
