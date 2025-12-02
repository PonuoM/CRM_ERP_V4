<?php
/**
 * Script สำหรับอัพเดท COD orders ที่ผ่านการ reconcile แล้วแต่ยังไม่ได้อัพเดทสถานะ
 * - อัพเดท payment_status เป็น "Approved" ถ้า amount_paid >= total_amount
 * - อัพเดท order_status เป็น "Delivered" ถ้า payment_status เป็น "Approved"
 * 
 * Usage: php fix_existing_cod_orders.php
 */

header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");

if (php_sapi_name() === 'cli') {
    require_once __DIR__ . "/../config.php";
} else {
    require_once "../config.php";
}

$companyId = isset($_GET['companyId']) ? (int)$_GET['companyId'] : null;

try {
    $pdo = db_connect();
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    $pdo->beginTransaction();
    
    // Find COD orders that are in verified cod_documents
    // Get parent order ID from cod_records (remove -1, -2 suffix)
    $sql = "
        SELECT DISTINCT 
            o.id,
            o.order_status,
            o.payment_status,
            o.payment_method,
            o.company_id,
            o.amount_paid,
            o.total_amount
        FROM cod_records cr
        INNER JOIN cod_documents cd ON cd.id = cr.document_id
        INNER JOIN orders o ON o.id = REGEXP_REPLACE(cr.order_id, '-[0-9]+$', '')
        WHERE cd.status = 'verified'
          AND cr.order_id IS NOT NULL
          AND cr.order_id != ''
          AND o.payment_method = 'COD'
    ";
    
    $params = [];
    if ($companyId) {
        $sql .= " AND o.company_id = :companyId";
        $params[':companyId'] = $companyId;
    }
    
    $sql .= " GROUP BY o.id";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    $results = [
        'total_found' => count($orders),
        'updated_payment_status' => 0,
        'updated_order_status' => 0,
        'orders' => []
    ];
    
    // Update payment_status to Approved if amount_paid >= total_amount
    $updatePaymentStmt = $pdo->prepare("
        UPDATE orders
        SET payment_status = 'Approved'
        WHERE id = :orderId
          AND company_id = :companyId
          AND payment_method = 'COD'
          AND payment_status != 'Approved'
          AND payment_status != 'Paid'
          AND amount_paid >= (total_amount - 0.01)
    ");
    
    // Update order_status to Delivered if payment_status is Approved/Paid
    $updateOrderStatusStmt = $pdo->prepare("
        UPDATE orders
        SET order_status = 'Delivered'
        WHERE id = :orderId
          AND company_id = :companyId
          AND payment_method = 'COD'
          AND payment_status IN ('Approved', 'Paid')
          AND order_status != 'Delivered'
    ");
    
    foreach ($orders as $order) {
        $orderId = $order['id'];
        $companyId = $order['company_id'];
        
        // Update payment_status
        $updatePaymentStmt->execute([
            ':orderId' => $orderId,
            ':companyId' => $companyId
        ]);
        $paymentAffected = $updatePaymentStmt->rowCount();
        
        if ($paymentAffected > 0) {
            $results['updated_payment_status']++;
        }
        
        // Update order_status
        $updateOrderStatusStmt->execute([
            ':orderId' => $orderId,
            ':companyId' => $companyId
        ]);
        $statusAffected = $updateOrderStatusStmt->rowCount();
        
        if ($statusAffected > 0) {
            $results['updated_order_status']++;
        }
        
        // Get updated status
        $checkStmt = $pdo->prepare("SELECT order_status, payment_status FROM orders WHERE id = ?");
        $checkStmt->execute([$orderId]);
        $updated = $checkStmt->fetch(PDO::FETCH_ASSOC);
        
        if ($updated && ($paymentAffected > 0 || $statusAffected > 0)) {
            $results['orders'][] = [
                'order_id' => $orderId,
                'old_payment_status' => $order['payment_status'],
                'new_payment_status' => $updated['payment_status'],
                'old_order_status' => $order['order_status'],
                'new_order_status' => $updated['order_status'],
                'amount_paid' => $order['amount_paid'],
                'total_amount' => $order['total_amount']
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
            error_log("fix_existing_cod_orders.php Rollback failed: " . $rollbackEx->getMessage());
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
