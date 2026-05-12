<?php
/**
 * save_return_orders.php
 * บันทึกสถานะการคืนสินค้าลงตาราง order_boxes
 * ใช้ order_boxes แทน order_returns
 *
 * Payload: { returns: [{ sub_order_id, status, note, tracking_number?, return_complete?, return_claim?, returned_by? }] }
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
    set_audit_context($pdo, 'orders/save_return');

    $updatedCount = 0;
    $errors = [];
    $affectedOrderIds = []; // Track order_ids that need total_amount recalc
    $processedBoxIds = []; // Track already-processed box IDs (dedup for multi-tracking same box)

    // ─── Prepare statements for efficient execution and Pessimistic Locking (FOR UPDATE) ───
    $stmtBySubId = $pdo->prepare("SELECT id, order_id, box_number FROM order_boxes WHERE sub_order_id = ? LIMIT 1 FOR UPDATE");
    $stmtByOrderIdBox = $pdo->prepare("SELECT id, order_id, box_number FROM order_boxes WHERE order_id = ? AND box_number = ? LIMIT 1 FOR UPDATE");
    $stmtByTracking = $pdo->prepare("
        SELECT ob.id, ob.order_id, ob.box_number
        FROM order_tracking_numbers otn
        JOIN order_boxes ob ON ob.order_id = otn.parent_order_id AND ob.box_number = otn.box_number
        WHERE otn.tracking_number = ?
        LIMIT 1 FOR UPDATE
    ");
    $stmtAllReturned = $pdo->prepare("
        SELECT
            COUNT(*) as total_boxes,
            SUM(CASE WHEN status = 'RETURNED' THEN 1 ELSE 0 END) as returned_boxes
        FROM order_boxes
        WHERE order_id = ?
        FOR UPDATE
    ");
    $stmtCheckParent = $pdo->prepare("SELECT order_status FROM orders WHERE id = ? FOR UPDATE");

    $orderCache = []; // Cache to prevent N+1 queries for boxes belonging to the same order

    foreach ($returns as $item) {
        $subOrderId = $item['sub_order_id'] ?? '';
        $status = array_key_exists('status', $item) ? $item['status'] : 'returning';
        $note = $item['note'] ?? '';
        $trackingNumber = $item['tracking_number'] ?? '';
        $returnComplete = isset($item['return_complete']) ? (int) $item['return_complete'] : 0;
        $returnClaim = isset($item['return_claim']) ? (float) $item['return_claim'] : null;
        $returnedBy = isset($item['returned_by']) ? (int) $item['returned_by'] : null;

        // ─── Resolve order_boxes row ───
        $boxRow = null;

        if ($subOrderId) {
            $stmtBySubId->execute([$subOrderId]);
            $boxRow = $stmtBySubId->fetch(PDO::FETCH_ASSOC);
        }

        if (!$boxRow && isset($item['order_id'], $item['box_number'])) {
            $stmtByOrderIdBox->execute([$item['order_id'], $item['box_number']]);
            $boxRow = $stmtByOrderIdBox->fetch(PDO::FETCH_ASSOC);
        }

        if (!$boxRow && $trackingNumber) {
            $stmtByTracking->execute([$trackingNumber]);
            $boxRow = $stmtByTracking->fetch(PDO::FETCH_ASSOC);
        }

        if (!$boxRow) {
            $errors[] = "Box not found for sub_order_id=$subOrderId tracking=$trackingNumber";
            continue;
        }

        // ─── Dedup: skip if this box was already processed (multi-tracking same box) ───
        if (in_array($boxRow['id'], $processedBoxIds)) {
            continue; // Already updated this box from another tracking row
        }
        $processedBoxIds[] = $boxRow['id'];

        // ─── Determine if this is a return or an undo ───
        $returnStatuses = ['returning', 'returned', 'good', 'damaged', 'lost'];
        $isReturn = in_array($status, $returnStatuses);

        // Business rule: จบเคส (return_complete=1) ทำได้เฉพาะสถานะ 'good' เท่านั้น
        // หากเปลี่ยนจาก good → สถานะอื่น → reset return_complete = 0
        if ($status !== 'good') {
            $returnComplete = 0;
        }

        // ─── Block undo (pending/delivered/empty) if ALL boxes are already RETURNED ───
        $undoStatuses = ['pending', 'delivered', ''];
        
        $orderId = $boxRow['order_id'];
        if (!isset($orderCache[$orderId])) {
            $stmtAllReturned->execute([$orderId]);
            $boxCounts = $stmtAllReturned->fetch(PDO::FETCH_ASSOC);
            
            $stmtCheckParent->execute([$orderId]);
            $parent = $stmtCheckParent->fetch(PDO::FETCH_ASSOC);
            
            $orderCache[$orderId] = [
                'boxCounts' => $boxCounts,
                'parent' => $parent
            ];
        }
        $boxCounts = $orderCache[$orderId]['boxCounts'];
        $parent = $orderCache[$orderId]['parent'];

        if ($boxCounts && $boxCounts['total_boxes'] > 0 && $boxCounts['total_boxes'] == $boxCounts['returned_boxes'] && in_array($status, $undoStatuses)) {
            if ($parent && strcasecmp($parent['order_status'], 'Returned') === 0 && empty($input['parent_order_status'])) {
                $errors[] = "Order {$orderId} ตีกลับครบทุกกล่องแล้ว กรุณาใช้ปุ่ม 'ยกเลิกตีกลับ' เพื่อเปลี่ยนสถานะทั้ง Order";
                continue;
            }
        }

        if ($isReturn) {
            // Return flow: set collection_amount = 0, mark as RETURNED
            // + return_complete (สำหรับ good) และ return_claim (สำหรับ damaged/lost)
            $stmtUpdate = $pdo->prepare("
                UPDATE order_boxes
                SET return_status = ?,
                    return_note = COALESCE(?, return_note),
                    return_created_at = COALESCE(return_created_at, NOW()),
                    status = 'RETURNED',
                    collected_amount = 0,
                    collection_amount = 0,
                    return_complete = ?,
                    return_claim = ?,
                    returned_by = COALESCE(?, returned_by),
                    updated_at = NOW()
                WHERE id = ?
            ");
            $stmtUpdate->execute([$status, $note ?: null, $returnComplete, $returnClaim, $returnedBy, $boxRow['id']]);
        } else {
            // Undo flow (pending, delivered, etc.): restore collection_amount = cod_amount, clear return fields
            // If status is null (from OrderManagementModal clearing the dropdown), revert to parent order status
            $revertStatus = $status;
            if (!$revertStatus) {
                if (!empty($input['parent_order_status'])) {
                    $revertStatus = $input['parent_order_status'];
                } else {
                    $parentOrder = $orderCache[$orderId]['parent'];
                    $revertStatus = $parentOrder ? $parentOrder['order_status'] : 'PENDING';
                }
                
                // Safety check: if reverting, the box status shouldn't remain 'RETURNED'
                if (strtoupper($revertStatus) === 'RETURNED') {
                    $revertStatus = 'PENDING';
                }
            }

            // Workaround for MySQL Trigger 1644: "cannot change collection_amount after shipping"
            // We split the update: first restore collection_amount (while status is still RETURNED), then change status to SHIPPING.
            $stmtRestoreAmount = $pdo->prepare("UPDATE order_boxes SET collection_amount = cod_amount WHERE id = ?");
            $stmtRestoreAmount->execute([$boxRow['id']]);

            $stmtUpdate = $pdo->prepare("
                UPDATE order_boxes
                SET return_status = NULL,
                    return_note = NULL,
                    return_created_at = NULL,
                    return_complete = 0,
                    return_claim = NULL,
                    returned_by = NULL,
                    status = UPPER(?),
                    collected_amount = 0,
                    updated_at = NOW()
                WHERE id = ?
            ");
            $stmtUpdate->execute([$revertStatus, $boxRow['id']]);
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

    // ─── Auto-set or Explicitly set orders.order_status ───
    if (!empty($affectedOrderIds)) {
        $parentOrderStatus = $input['parent_order_status'] ?? null;

        if ($parentOrderStatus) {
            // Explicit override from payload (e.g. user chose to Undo and picked a new status)
            $stmtSetParent = $pdo->prepare("UPDATE orders SET order_status = ? WHERE id = ?");
            foreach (array_keys($affectedOrderIds) as $orderId) {
                $stmtSetParent->execute([$parentOrderStatus, $orderId]);
            }
        } else {
            // Auto-set to 'Returned' if ALL boxes are returned
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