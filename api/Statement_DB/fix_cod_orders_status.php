<?php
/**
 * Script สำหรับอัพเดท order_status ของ COD orders ที่ payment_status = "Approved" 
 * ให้เป็น "Delivered" (เสร็จสิ้น)
 * 
 * Usage: php fix_cod_orders_status.php
 * หรือเรียกผ่าน browser: http://localhost/api/Statement_DB/fix_cod_orders_status.php
 */

header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");

// Support both web and CLI execution
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
    
    // Find COD orders that were reconciled (have matched cod_records from verified cod_documents)
    // but order_status is not "Delivered"
    // These are orders that were reconciled but status wasn't updated correctly
    $sql = "
        SELECT DISTINCT o.id, o.order_status, o.payment_status, o.payment_method, o.company_id
        FROM orders o
        INNER JOIN cod_records cr ON cr.order_id = o.id AND cr.status = 'matched'
        INNER JOIN cod_documents cd ON cd.id = cr.document_id AND cd.status = 'verified'
        WHERE o.payment_method = 'COD'
          AND o.order_status != 'Delivered'
    ";
    
    $params = [];
    if ($companyId) {
        $sql .= " AND o.company_id = :companyId";
        $params[':companyId'] = $companyId;
    }
    
    $sql .= " ORDER BY o.id";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    $results = [
        'total_found' => count($orders),
        'updated' => 0,
        'skipped' => 0,
        'orders' => []
    ];
    
    // Update each order
    // Update to Delivered if payment_status is Approved/Paid
    // Otherwise keep current status but ensure it's at least Preparing
    $updateStmt = $pdo->prepare("
        UPDATE orders
        SET order_status = CASE
            WHEN payment_status IN ('Approved', 'Paid') THEN 'Delivered'
            ELSE order_status
        END
        WHERE id = :orderId
          AND company_id = :companyId
          AND order_status != 'Delivered'
    ");
    
    foreach ($orders as $order) {
        $updateStmt->execute([
            ':orderId' => $order['id'],
            ':companyId' => $order['company_id']
        ]);
        
        $affected = $updateStmt->rowCount();
        if ($affected > 0) {
            $results['updated']++;
            $results['orders'][] = [
                'order_id' => $order['id'],
                'old_status' => $order['order_status'],
                'new_status' => 'Delivered',
                'payment_status' => $order['payment_status']
            ];
        } else {
            $results['skipped']++;
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
            error_log("fix_cod_orders_status.php Rollback failed: " . $rollbackEx->getMessage());
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
