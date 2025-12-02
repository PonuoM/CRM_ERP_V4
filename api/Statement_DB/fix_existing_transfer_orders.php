<?php
/**
 * Script สำหรับอัพเดท Transfer orders ที่ผ่านการ reconcile แล้วแต่ยังไม่ได้อัพเดทสถานะ
 * - อัพเดท order_status เป็น "Delivered" ถ้า payment_status เป็น "Approved" หรือ "Paid"
 * 
 * Usage: php fix_existing_transfer_orders.php
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
    
    // Find Transfer orders that have payment_status = "Approved" or "Paid" but order_status != "Delivered"
    $sql = "
        SELECT o.id, o.order_status, o.payment_status, o.payment_method, o.company_id
        FROM orders o
        WHERE o.payment_method = 'Transfer'
          AND o.payment_status IN ('Approved', 'Paid')
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
        'orders' => []
    ];
    
    // Update each order to Delivered
    $updateStmt = $pdo->prepare("
        UPDATE orders
        SET order_status = 'Delivered'
        WHERE id = :orderId
          AND company_id = :companyId
          AND payment_method = 'Transfer'
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
            error_log("fix_existing_transfer_orders.php Rollback failed: " . $rollbackEx->getMessage());
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
