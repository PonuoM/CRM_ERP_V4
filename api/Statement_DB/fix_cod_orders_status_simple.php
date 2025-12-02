<?php
/**
 * Script สำหรับอัพเดท order_status ของ COD orders ที่ผ่านการ reconcile แล้ว
 * ให้เป็น "Delivered" (เสร็จสิ้น) และอัพเดท cod_records.status เป็น 'matched'
 * 
 * Usage: php fix_cod_orders_status_simple.php
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
    
    // Find orders that are in verified cod_documents
    // Also check parent orders (without -1, -2 suffix)
    $sql = "
        SELECT DISTINCT 
            COALESCE(o.id, o_parent.id) as order_id,
            COALESCE(o.order_status, o_parent.order_status) as order_status,
            COALESCE(o.payment_status, o_parent.payment_status) as payment_status,
            COALESCE(o.payment_method, o_parent.payment_method) as payment_method,
            COALESCE(o.company_id, o_parent.company_id) as company_id,
            cr.id as cod_record_id,
            cr.order_id as cod_record_order_id
        FROM cod_records cr
        INNER JOIN cod_documents cd ON cd.id = cr.document_id
        LEFT JOIN orders o ON o.id = cr.order_id
        LEFT JOIN orders o_parent ON o_parent.id = SUBSTRING_INDEX(cr.order_id, '-', 1)
        WHERE cd.status = 'verified'
          AND cr.order_id IS NOT NULL
          AND cr.order_id != ''
          AND (o.id IS NOT NULL OR o_parent.id IS NOT NULL)
          AND COALESCE(o.order_status, o_parent.order_status) != 'Delivered'
    ";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    $results = [
        'total_found' => count($orders),
        'updated_orders' => 0,
        'updated_cod_records' => 0,
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
          AND company_id = :companyId
          AND payment_method = 'COD'
    ");
    
    // Update cod_records status to matched
    $updateCodRecordStmt = $pdo->prepare("
        UPDATE cod_records
        SET status = 'matched'
        WHERE id = :recordId
          AND status != 'matched'
    ");
    
    foreach ($orders as $order) {
        $orderId = $order['order_id'];
        $companyId = $order['company_id'];
        
        // Update order status
        $updateOrderStmt->execute([
            ':orderId' => $orderId,
            ':companyId' => $companyId
        ]);
        
        $orderAffected = $updateOrderStmt->rowCount();
        if ($orderAffected > 0) {
            $results['updated_orders']++;
        }
        
        // Update cod_record status
        if ($order['cod_record_id']) {
            $updateCodRecordStmt->execute([
                ':recordId' => $order['cod_record_id']
            ]);
            
            $recordAffected = $updateCodRecordStmt->rowCount();
            if ($recordAffected > 0) {
                $results['updated_cod_records']++;
            }
        }
        
        // Get updated status
        $checkStmt = $pdo->prepare("SELECT order_status, payment_status FROM orders WHERE id = ?");
        $checkStmt->execute([$orderId]);
        $updated = $checkStmt->fetch(PDO::FETCH_ASSOC);
        
        if ($updated) {
            $results['orders'][] = [
                'order_id' => $orderId,
                'cod_record_order_id' => $order['cod_record_order_id'],
                'old_status' => $order['order_status'],
                'new_status' => $updated['order_status'],
                'payment_status' => $updated['payment_status']
            ];
        }
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
            error_log("fix_cod_orders_status_simple.php Rollback failed: " . $rollbackEx->getMessage());
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
