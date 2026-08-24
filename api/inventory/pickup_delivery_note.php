<?php
/**
 * ขั้นที่ 4 ของเวิร์กโฟลว์: Airport ขับรถมารับของตามใบขน -> ยอดย้ายจากโรงงานเข้าคลัง
 *
 * action = pickup : ปิดใบขนเป็น picked_up + บันทึกคลังปลายทาง/วันที่รับ/ยอดที่รับจริง
 * action = undo   : ถอนกลับเป็น issued (คีย์ผิด) -- เฉพาะคนที่มีสิทธิ์จัดการ
 *
 * หมายเหตุ: เฟสนี้ยังไม่ยิงเข้า stock_movements/warehouse_stocks จริง
 * (คอลัมน์ posted_to_stock เตรียมไว้สำหรับเฟสถัดไปเมื่อเลิกคีย์ซ้ำกับหน้ารับเข้า V2)
 */
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once '../config.php';
require_once 'production_permission.php';
$pdo = db_connect();

try {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input) {
        throw new Exception('Invalid input');
    }

    $userId = $input['user_id'] ?? null;
    production_require_manage($pdo, $userId);

    $id     = isset($input['id']) ? (int)$input['id'] : 0;
    $action = $input['action'] ?? 'pickup';
    if ($id <= 0) {
        throw new Exception('Missing delivery note id');
    }

    $cur = $pdo->prepare('SELECT status FROM production_delivery_notes WHERE id = ? LIMIT 1');
    $cur->execute([$id]);
    $curStatus = $cur->fetchColumn();
    if ($curStatus === false) {
        throw new Exception('ไม่พบใบขนที่ระบุ');
    }

    $pdo->beginTransaction();

    if ($action === 'undo') {
        if ($curStatus !== 'picked_up') {
            throw new Exception('ใบขนนี้ยังไม่ได้รับเข้าคลัง');
        }
        $pdo->prepare('UPDATE production_delivery_notes
                       SET status = ?, warehouse_id = NULL, received_date = NULL,
                           picked_up_by = NULL, picked_up_at = NULL
                       WHERE id = ?')->execute(['issued', $id]);
        $pdo->prepare('UPDATE production_delivery_note_items SET received_qty = NULL WHERE delivery_note_id = ?')
            ->execute([$id]);

    } else {
        if ($curStatus === 'cancelled') {
            throw new Exception('ใบขนนี้ถูกยกเลิกแล้ว');
        }
        if ($curStatus === 'picked_up') {
            throw new Exception('ใบขนนี้รับเข้าคลังไปแล้ว');
        }

        $warehouseId  = isset($input['warehouse_id']) ? (int)$input['warehouse_id'] : 0;
        $receivedDate = $input['received_date'] ?? date('Y-m-d');
        $vehicleNote  = isset($input['vehicle_note']) ? trim($input['vehicle_note']) : null;
        $receivedItems = $input['items'] ?? [];

        if ($warehouseId <= 0) {
            throw new Exception('ต้องเลือกคลังปลายทาง');
        }

        // ยอดที่รับจริง — ไม่ส่งมา = รับครบตามใบขน
        if (!empty($receivedItems)) {
            $line = $pdo->prepare('SELECT qty FROM production_delivery_note_items
                                   WHERE id = ? AND delivery_note_id = ? LIMIT 1');
            $upd = $pdo->prepare('UPDATE production_delivery_note_items
                                  SET received_qty = ?, note = COALESCE(?, note)
                                  WHERE id = ? AND delivery_note_id = ?');
            foreach ($receivedItems as $ri) {
                $itemId = isset($ri['id']) ? (int)$ri['id'] : 0;
                if ($itemId <= 0) continue;
                $line->execute([$itemId, $id]);
                $qty = $line->fetchColumn();
                if ($qty === false) {
                    throw new Exception('รายการที่รับเข้าไม่ตรงกับใบขนนี้');
                }
                $received = isset($ri['received_qty']) ? (int)$ri['received_qty'] : (int)$qty;
                if ($received < 0) {
                    throw new Exception('ยอดที่รับจริงติดลบไม่ได้');
                }
                if ($received > (int)$qty) {
                    throw new Exception('ยอดที่รับจริงมากกว่ายอดในใบขนไม่ได้');
                }
                $upd->execute([$received, $ri['note'] ?? null, $itemId, $id]);
            }
        }
        // บรรทัดที่ไม่ได้ระบุยอดรับจริง = รับครบตามใบขน
        $pdo->prepare('UPDATE production_delivery_note_items
                       SET received_qty = qty
                       WHERE delivery_note_id = ? AND received_qty IS NULL')->execute([$id]);

        $pdo->prepare('UPDATE production_delivery_notes
                       SET status = ?, warehouse_id = ?, received_date = ?,
                           picked_up_by = ?, picked_up_at = NOW(),
                           vehicle_note = COALESCE(?, vehicle_note)
                       WHERE id = ?')
            ->execute(['picked_up', $warehouseId, $receivedDate, $userId, $vehicleNote ?: null, $id]);
    }

    $pdo->commit();
    echo json_encode(['success' => true]);

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
