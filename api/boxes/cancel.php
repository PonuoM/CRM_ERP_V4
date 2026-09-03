<?php
/**
 * api/boxes/cancel.php
 * ยกเลิกกล่องเฉพาะกล่องที่เลือก (CANCELLED) โดยปรับ collection_amount = 0 และตัดออกจากยอดขาย
 */
require_once __DIR__ . '/../config.php';
cors();
$pdo = db_connect();

header('Content-Type: application/json; charset=utf-8');

try {
    $input = json_decode(file_get_contents('php://input'), true);
    $orderId = $input['order_id'] ?? '';
    $boxNumber = $input['box_number'] ?? '';

    if (!$orderId || !$boxNumber) {
        throw new Exception('Missing order_id or box_number');
    }

    $pdo->beginTransaction();

    // Set status to CANCELLED and zero out the financial amounts
    // We explicitly set status = 'CANCELLED' so it doesn't match 'RETURNED'
    $stmtUpdate = $pdo->prepare("
        UPDATE order_boxes 
        SET status = 'CANCELLED', 
            collection_amount = 0, 
            cod_amount = 0, 
            collected_amount = 0,
            waived_amount = 0,
            updated_at = NOW()
        WHERE order_id = ? AND box_number = ?
    ");
    $stmtUpdate->execute([$orderId, $boxNumber]);

    // Recalculate orders.total_amount for COD/PayAfter
    // To ensure the cancelled box no longer contributes to the order total
    $stmtRecalc = $pdo->prepare("
        UPDATE orders
        SET total_amount = (
            SELECT COALESCE(SUM(ob.collection_amount), 0)
            FROM order_boxes ob
            WHERE ob.order_id = orders.id
        )
        WHERE id = ? AND payment_method IN ('COD', 'PayAfter')
    ");
    $stmtRecalc->execute([$orderId]);

    $pdo->commit();
    echo json_encode(['success' => true]);
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
