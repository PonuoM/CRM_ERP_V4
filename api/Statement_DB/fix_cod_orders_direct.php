<?php
/**
 * Script สำหรับอัพเดท order_status ของ COD orders ที่ผ่านการ reconcile แล้ว
 * ให้เป็น "Delivered" (เสร็จสิ้น) และอัพเดท cod_records.status เป็น 'matched'
 * 
 * Usage: php fix_cod_orders_direct.php
 */

header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");

if (php_sapi_name() === 'cli') {
    require_once __DIR__ . "/../config.php";
} else {
    require_once "../config.php";
}

try {
    $pdo = db_connect();
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    $pdo->beginTransaction();
    
    // Find cod_records from verified cod_documents
    $sql = "
        SELECT cr.id as cod_record_id, cr.order_id, cr.status as cod_record_status, cd.document_number
        FROM cod_records cr
        INNER JOIN cod_documents cd ON cd.id = cr.document_id
        WHERE cd.status = 'verified'
          AND cr.order_id IS NOT NULL
          AND cr.order_id != ''
    ";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    $codRecords = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    $results = [
        'total_cod_records' => count($codRecords),
        'updated_orders' => 0,
        'updated_cod_records' => 0,
        'orders_not_found' => 0,
        'orders' => []
    ];
    
    // Update orders to Delivered if payment_status is Approved/Paid
    $updateOrderStmt = $pdo->prepare("
        UPDATE orders
        SET order_status = CASE
            WHEN payment_status IN ('Approved', 'Paid') THEN 'Delivered'
            ELSE order_status
        END
        WHERE id = :orderId
          AND payment_method = 'COD'
          AND order_status != 'Delivered'
    ");
    
    // Update cod_records status to matched
    $updateCodRecordStmt = $pdo->prepare("
        UPDATE cod_records
        SET status = 'matched'
        WHERE id = :recordId
          AND status != 'matched'
    ");
    
    // Check if order exists
    $checkOrderStmt = $pdo->prepare("SELECT id, order_status, payment_status FROM orders WHERE id = ?");
    
    foreach ($codRecords as $codRecord) {
        $orderId = $codRecord['order_id'];
        
        // Check if order exists
        $checkOrderStmt->execute([$orderId]);
        $order = $checkOrderStmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$order) {
            $results['orders_not_found']++;
            // Still update cod_record status
            $updateCodRecordStmt->execute([':recordId' => $codRecord['cod_record_id']]);
            if ($updateCodRecordStmt->rowCount() > 0) {
                $results['updated_cod_records']++;
            }
            continue;
        }
        
        // Update order status
        $updateOrderStmt->execute([':orderId' => $orderId]);
        $orderAffected = $updateOrderStmt->rowCount();
        
        if ($orderAffected > 0) {
            $results['updated_orders']++;
        }
        
        // Update cod_record status
        $updateCodRecordStmt->execute([':recordId' => $codRecord['cod_record_id']]);
        $recordAffected = $updateCodRecordStmt->rowCount();
        
        if ($recordAffected > 0) {
            $results['updated_cod_records']++;
        }
        
        // Get updated status
        $checkOrderStmt->execute([$orderId]);
        $updated = $checkOrderStmt->fetch(PDO::FETCH_ASSOC);
        
        $results['orders'][] = [
            'order_id' => $orderId,
            'old_status' => $order['order_status'],
            'new_status' => $updated['order_status'],
            'payment_status' => $updated['payment_status'],
            'cod_record_updated' => $recordAffected > 0
        ];
    }
    
    $pdo->commit();
    
    echo json_encode([
        'ok' => true,
        'message' => 'Update completed successfully',
        'results' => $results
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    
} catch (Exception $e) {
    if ($pdo && $pdo->inTransaction()) {
        try {
            $pdo->rollBack();
        } catch (Exception $rollbackEx) {
            error_log("fix_cod_orders_direct.php Rollback failed: " . $rollbackEx->getMessage());
        }
    }
    
    http_response_code(500);
    echo json_encode([
        'ok' => false,
        'error' => $e->getMessage(),
        'file' => basename($e->getFile()),
        'line' => $e->getLine(),
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
}
