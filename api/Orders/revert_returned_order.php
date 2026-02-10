<?php
/**
 * revert_returned_order.php
 * ยกเลิกสถานะ Returned ของ Order และรีเซ็ตกล่องทั้งหมด
 *
 * Payload: { order_id: string, new_status: string }
 *
 * Allowed new_status values:
 *   Pending, AwaitingVerification, Confirmed, Preparing, Picking,
 *   Shipping, PreApproved, Delivered, Cancelled, Claiming, BadDebt
 *
 * Logic:
 * 1. Verify orders.order_status = 'Returned'
 * 2. Update orders.order_status = new_status
 * 3. Clear ALL order_boxes: return_status=NULL, return_note=NULL, return_created_at=NULL
 * 4. Update order_boxes.status = UPPER(new_status)
 * 5. Restore order_boxes.collection_amount = cod_amount
 * 6. Recalc orders.total_amount for COD/PayAfter
 */

require_once __DIR__ . '/../config.php';
cors();
$pdo = db_connect();

header('Content-Type: application/json; charset=utf-8');

$allowedStatuses = [
    'Pending',
    'AwaitingVerification',
    'Confirmed',
    'Preparing',
    'Picking',
    'Shipping',
    'PreApproved',
    'Delivered',
    'Cancelled',
    'Claiming',
    'BadDebt'
];

try {
    $input = json_decode(file_get_contents('php://input'), true);
    $orderId = $input['order_id'] ?? '';
    $newStatus = $input['new_status'] ?? '';

    // ─── Validate input ───
    if (empty($orderId)) {
        echo json_encode(['status' => 'error', 'message' => 'order_id is required']);
        exit;
    }
    if (!in_array($newStatus, $allowedStatuses)) {
        echo json_encode(['status' => 'error', 'message' => 'Invalid status. Allowed: ' . implode(', ', $allowedStatuses)]);
        exit;
    }

    // ─── Check current order status ───
    $stmtOrder = $pdo->prepare("SELECT id, order_status, payment_method FROM orders WHERE id = ? LIMIT 1");
    $stmtOrder->execute([$orderId]);
    $order = $stmtOrder->fetch(PDO::FETCH_ASSOC);

    if (!$order) {
        echo json_encode(['status' => 'error', 'message' => 'Order not found']);
        exit;
    }
    if ($order['order_status'] !== 'Returned') {
        echo json_encode(['status' => 'error', 'message' => 'Order is not in Returned status (current: ' . $order['order_status'] . ')']);
        exit;
    }

    $pdo->beginTransaction();

    // ─── 1. Update orders.order_status ───
    $stmtUpdateOrder = $pdo->prepare("UPDATE orders SET order_status = ? WHERE id = ?");
    $stmtUpdateOrder->execute([$newStatus, $orderId]);

    // ─── 2. Reset ALL order_boxes ───
    $boxStatus = strtoupper($newStatus);
    $stmtResetBoxes = $pdo->prepare("
        UPDATE order_boxes
        SET return_status = NULL,
            return_note = NULL,
            return_created_at = NULL,
            status = ?,
            collected_amount = 0,
            collection_amount = cod_amount,
            updated_at = NOW()
        WHERE order_id = ?
    ");
    $stmtResetBoxes->execute([$boxStatus, $orderId]);
    $resetCount = $stmtResetBoxes->rowCount();

    // ─── 3. Recalc orders.total_amount for COD/PayAfter ───
    if (in_array($order['payment_method'], ['COD', 'PayAfter'])) {
        $stmtRecalc = $pdo->prepare("
            UPDATE orders
            SET total_amount = (
                SELECT COALESCE(SUM(ob.collection_amount), 0)
                FROM order_boxes ob
                WHERE ob.order_id = orders.id
            )
            WHERE id = ?
        ");
        $stmtRecalc->execute([$orderId]);
    }

    $pdo->commit();

    echo json_encode([
        'status' => 'success',
        'message' => "Order $orderId reverted to $newStatus, $resetCount boxes reset",
        'order_id' => $orderId,
        'new_status' => $newStatus,
        'boxes_reset' => $resetCount,
    ]);
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => $e->getMessage(),
    ]);
}
