<?php
/**
 * Script สำหรับอัพเดท order_status ของ COD orders ที่ผ่านการ reconcile แล้ว
 * ให้เป็น "Delivered" (เสร็จสิ้น) เมื่อ payment_status เป็น "Approved" หรือ "Paid"
 * 
 * Usage: php fix_cod_orders_final.php
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
    
    // Find COD orders that have payment_status = "Approved" or "Paid" but order_status != "Delivered"
    // These are orders that were reconciled but status wasn't updated correctly
    $sql = "
        SELECT o.id, o.order_status, o.payment_status, o.payment_method, o.company_id
        FROM orders o
        WHERE o.payment_method = 'COD'
          AND o.payment_status IN ('Approved', 'Paid')
          AND o.order_status != 'Delivered'
    ";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    $results = [
        'total_found' => count($orders),
        'updated' => 0,
        'orders' => []
    ];
    
    // Update each order to Delivered
    $updateStmt = $pdo->prepare("
        UPDATE orders
        SET order_status = 'Delivered'
        WHERE id = :orderId
          AND company_id = :companyId
          AND payment_method = 'COD'
          AND payment_status IN ('Approved', 'Paid')
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
            error_log("fix_cod_orders_final.php Rollback failed: " . $rollbackEx->getMessage());
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
