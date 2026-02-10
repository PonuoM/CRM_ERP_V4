<?php
/**
 * save_return_orders.php
 * บันทึกสถานะการคืนสินค้าลงตาราง order_boxes
 * ใช้ order_boxes แทน order_returns
 *
 * Payload: { returns: [{ sub_order_id, status, note, tracking_number? }] }
 *
 * Business Rules:
 * - Return statuses (returning, returned, good, damaged, lost):
 *     → SET collection_amount=0, collected_amount=0, status='RETURNED'
 * - Undo statuses (pending, delivered, etc.):
 *     → RESTORE collection_amount=cod_amount, CLEAR return_status/note/created_at
 * - Recalc orders.total_amount ONLY for COD/PayAfter payment methods
 */

require_once __DIR__ . '/../config.php';
cors();
$pdo = db_connect();

header('Content-Type: application/json; charset=utf-8');

try {
    $input = json_decode(file_get_contents('php://input'), true);
    $returns = $input['returns'] ?? [];

    if (empty($returns)) {
        echo json_encode(['success' => false, 'error' => 'No return data provided']);
        exit;
    }

    $pdo->beginTransaction();

    $updatedCount = 0;
    $errors = [];
    $affectedOrderIds = []; // Track order_ids that need total_amount recalc

    foreach ($returns as $item) {
        $subOrderId = $item['sub_order_id'] ?? '';
        $status = $item['status'] ?? 'returning';
        $note = $item['note'] ?? '';
        $trackingNumber = $item['tracking_number'] ?? '';

        // ─── Resolve order_boxes row ───
        $boxRow = null;

        // Method 1: By sub_order_id
        if ($subOrderId) {
            $stmt = $pdo->prepare("SELECT id, order_id, box_number FROM order_boxes WHERE sub_order_id = ? LIMIT 1");
            $stmt->execute([$subOrderId]);
            $boxRow = $stmt->fetch(PDO::FETCH_ASSOC);
        }

        // Method 2: By tracking_number → order_tracking_numbers → order_boxes
        if (!$boxRow && $trackingNumber) {
            $stmt = $pdo->prepare("
                SELECT ob.id, ob.order_id, ob.box_number
                FROM order_tracking_numbers otn
                JOIN order_boxes ob ON ob.order_id = otn.parent_order_id AND ob.box_number = otn.box_number
                WHERE otn.tracking_number = ?
                LIMIT 1
            ");
            $stmt->execute([$trackingNumber]);
            $boxRow = $stmt->fetch(PDO::FETCH_ASSOC);
        }

        if (!$boxRow) {
            $errors[] = "Box not found for sub_order_id=$subOrderId tracking=$trackingNumber";
            continue;
        }

        // ─── Determine if this is a return or an undo ───
        $returnStatuses = ['returning', 'returned', 'good', 'damaged', 'lost'];
        $isReturn = in_array($status, $returnStatuses);

        // ─── Block undo (pending/delivered) if ALL boxes are already RETURNED ───
        // Return sub-status changes (returning→returned→good→damaged→lost) are still allowed
        $undoStatuses = ['pending', 'delivered'];
        $stmtAllReturned = $pdo->prepare("
            SELECT
                COUNT(*) as total_boxes,
                SUM(CASE WHEN status = 'RETURNED' THEN 1 ELSE 0 END) as returned_boxes
            FROM order_boxes
            WHERE order_id = ?
        ");
        $stmtAllReturned->execute([$boxRow['order_id']]);
        $boxCounts = $stmtAllReturned->fetch(PDO::FETCH_ASSOC);

        if ($boxCounts && $boxCounts['total_boxes'] > 0 && $boxCounts['total_boxes'] == $boxCounts['returned_boxes'] && in_array($status, $undoStatuses)) {
            $errors[] = "Order {$boxRow['order_id']} ตีกลับครบทุกกล่องแล้ว กรุณาใช้ปุ่ม 'ยกเลิกตีกลับ' เพื่อเปลี่ยนสถานะทั้ง Order";
            continue;
        }

        if ($isReturn) {
            // Return flow: set collection_amount = 0, mark as RETURNED
            $stmtUpdate = $pdo->prepare("
                UPDATE order_boxes
                SET return_status = ?,
                    return_note = COALESCE(?, return_note),
                    return_created_at = COALESCE(return_created_at, NOW()),
                    status = 'RETURNED',
                    collected_amount = 0,
                    collection_amount = 0,
                    updated_at = NOW()
                WHERE id = ?
            ");
            $stmtUpdate->execute([$status, $note ?: null, $boxRow['id']]);
        } else {
            // Undo flow (pending, delivered, etc.): restore collection_amount = cod_amount, clear return_status
            $stmtUpdate = $pdo->prepare("
                UPDATE order_boxes
                SET return_status = NULL,
                    return_note = NULL,
                    return_created_at = NULL,
                    status = UPPER(?),
                    collected_amount = 0,
                    collection_amount = cod_amount,
                    updated_at = NOW()
                WHERE id = ?
            ");
            $stmtUpdate->execute([$status, $boxRow['id']]);
        }
        $updatedCount++;

        // Track affected order_id for total_amount recalc
        if ($boxRow['order_id']) {
            $affectedOrderIds[$boxRow['order_id']] = true;
        }
    }

    // ─── Recalculate orders.total_amount ONLY for COD/PayAfter orders ───
    if (!empty($affectedOrderIds)) {
        $stmtRecalc = $pdo->prepare("
            UPDATE orders
            SET total_amount = (
                SELECT COALESCE(SUM(ob.collection_amount), 0)
                FROM order_boxes ob
                WHERE ob.order_id = orders.id
            )
            WHERE id = ?
              AND payment_method IN ('COD', 'PayAfter')
        ");
        foreach (array_keys($affectedOrderIds) as $orderId) {
            $stmtRecalc->execute([$orderId]);
        }
    }

    // ─── Auto-set orders.order_status = 'Returned' when ALL boxes are RETURNED ───
    if (!empty($affectedOrderIds)) {
        $stmtCheckAll = $pdo->prepare("
            SELECT
                COUNT(*) as total_boxes,
                SUM(CASE WHEN ob.status = 'RETURNED' THEN 1 ELSE 0 END) as returned_boxes
            FROM order_boxes ob
            WHERE ob.order_id = ?
        ");
        $stmtSetReturned = $pdo->prepare("
            UPDATE orders SET order_status = 'Returned' WHERE id = ? AND order_status != 'Returned'
        ");
        foreach (array_keys($affectedOrderIds) as $orderId) {
            $stmtCheckAll->execute([$orderId]);
            $counts = $stmtCheckAll->fetch(PDO::FETCH_ASSOC);
            if ($counts && $counts['total_boxes'] > 0 && $counts['total_boxes'] == $counts['returned_boxes']) {
                $stmtSetReturned->execute([$orderId]);
            }
        }
    }

    $pdo->commit();

    echo json_encode([
        'status' => 'success',
        'message' => "Updated $updatedCount items",
        'updatedCount' => $updatedCount,
        'errors' => $errors,
    ]);
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage(),
    ]);
}