<?php
/**
 * คีย์/แก้ไขใบขน (ตุ๊กตาคีย์ตามใบขนที่โรงงานออกให้)
 *
 * กติกาที่กันไว้:
 *  - เลขใบขนห้ามซ้ำ
 *  - ทุกบรรทัดต้องอ้าง SO ของโรงงานเดียวกับใบขน
 *  - ยอดในใบขนรวมกันแล้วห้ามเกินยอดคงเหลือของบรรทัด SO นั้น (Super Admin ข้ามได้ด้วย force)
 *  - ใบขนที่รับเข้าคลังแล้ว (picked_up) แก้ไม่ได้ ต้องถอนการรับเข้าก่อน
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
require_once 'production_progress.php';
$pdo = db_connect();

try {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input) {
        throw new Exception('Invalid input');
    }

    $userId = $input['user_id'] ?? null;
    production_require_manage($pdo, $userId);

    $id          = isset($input['id']) ? (int)$input['id'] : 0;
    $dnNumber    = trim($input['dn_number'] ?? '');
    $factoryId   = isset($input['factory_id']) ? (int)$input['factory_id'] : 0;
    $issuedDate  = $input['issued_date'] ?? null;
    $vehicleNote = trim($input['vehicle_note'] ?? '');
    $note        = $input['note'] ?? '';
    $status      = $input['status'] ?? 'issued';
    $items       = $input['items'] ?? [];
    $force       = !empty($input['force']) && production_is_super_admin($pdo, $userId);

    /* ฟิลด์ที่มาจากใบขนต้นทาง (PDF) -- ส่งมาเฉพาะตอนนำเข้าไฟล์ */
    $docFields = [];
    foreach (['customer_code', 'customer_name', 'doc_receive_date', 'warehouse_name',
              'coordinator_name', 'driver_name', 'driver_phone', 'driver_id_card',
              'vehicle_plate', 'source_type', 'source_file',
              'source_path', 'source_size', 'source_hash'] as $f) {
        if (array_key_exists($f, $input)) {
            $docFields[$f] = ($input[$f] === '' ? null : $input[$f]);
        }
    }
    if (($docFields['source_type'] ?? '') === 'pdf') {
        $docFields['imported_at'] = date('Y-m-d H:i:s');
    }

    if ($dnNumber === '')   throw new Exception('ต้องระบุเลขใบขน');
    if ($factoryId <= 0)    throw new Exception('ต้องเลือกโรงงาน');
    if (empty($issuedDate)) throw new Exception('ต้องระบุวันที่ออกใบขน');
    if (empty($items))      throw new Exception('ต้องมีรายการสินค้าอย่างน้อย 1 รายการ');
    if (!in_array($status, ['issued', 'cancelled'], true)) {
        // การเปลี่ยนเป็น picked_up ทำผ่าน pickup_delivery_note.php เท่านั้น
        throw new Exception('สถานะไม่ถูกต้อง (การรับเข้าคลังให้ใช้ปุ่ม "รับเข้าคลัง")');
    }

    foreach ($items as $item) {
        if (empty($item['order_item_id']) || (int)($item['qty'] ?? 0) <= 0) {
            throw new Exception('รายการในใบขนไม่ถูกต้อง (ต้องเลือกรายการ SO และใส่จำนวนมากกว่า 0)');
        }
    }

    $dup = $pdo->prepare('SELECT id FROM production_delivery_notes WHERE dn_number = ? AND id <> ? LIMIT 1');
    $dup->execute([$dnNumber, $id]);
    if ($dup->fetchColumn()) {
        throw new Exception("เลขใบขน \"$dnNumber\" ถูกคีย์เข้าระบบไปแล้ว");
    }

    if ($id > 0) {
        $cur = $pdo->prepare('SELECT status FROM production_delivery_notes WHERE id = ? LIMIT 1');
        $cur->execute([$id]);
        $curStatus = $cur->fetchColumn();
        if ($curStatus === false) {
            throw new Exception('ไม่พบใบขนที่จะแก้ไข');
        }
        if ($curStatus === 'picked_up' && !$force) {
            throw new Exception('ใบขนนี้รับเข้าคลังแล้ว แก้ไม่ได้ — ให้ถอนการรับเข้าก่อน');
        }
    }

    // ตรวจว่าบรรทัด SO ทุกตัวเป็นของโรงงานเดียวกับใบขน + ยอดคงเหลือพอ
    $orderItemIds = array_map(function ($i) { return (int)$i['order_item_id']; }, $items);
    $ph = implode(',', array_fill(0, count($orderItemIds), '?'));
    $chk = $pdo->prepare("SELECT i.id, i.ordered_qty, o.factory_id, o.so_number, o.status AS so_status,
                                 p.name AS product_name,
                                 COALESCE((SELECT SUM(di.qty)
                                           FROM production_delivery_note_items di
                                           JOIN production_delivery_notes d ON d.id = di.delivery_note_id
                                           WHERE di.order_item_id = i.id
                                             AND d.status <> 'cancelled'
                                             AND d.id <> ?), 0) AS delivered_other
                          FROM production_order_items i
                          JOIN production_orders o ON o.id = i.order_id
                          JOIN stock_arrival_products p ON p.id = i.product_id
                          WHERE i.id IN ($ph)");
    $chk->execute(array_merge([$id], $orderItemIds));
    $meta = [];
    foreach ($chk->fetchAll(PDO::FETCH_ASSOC) as $r) {
        $meta[(int)$r['id']] = $r;
    }

    // รวมยอดต่อบรรทัด SO เผื่อ payload ส่งบรรทัดเดียวกันมาซ้ำ
    $qtyByItem = [];
    foreach ($items as $item) {
        $oid = (int)$item['order_item_id'];
        $qtyByItem[$oid] = ($qtyByItem[$oid] ?? 0) + (int)$item['qty'];
    }

    foreach ($qtyByItem as $oid => $qty) {
        if (!isset($meta[$oid])) {
            throw new Exception('รายการ SO ที่อ้างถึงไม่มีอยู่จริง');
        }
        $m = $meta[$oid];
        if ((int)$m['factory_id'] !== $factoryId) {
            throw new Exception("รายการ \"{$m['product_name']}\" อยู่ใน SO ของโรงงานอื่น (SO {$m['so_number']})");
        }
        if ($m['so_status'] === 'cancelled' && !$force) {
            throw new Exception("SO {$m['so_number']} ถูกยกเลิกไปแล้ว ออกใบขนไม่ได้");
        }
        if ($status !== 'cancelled') {
            $remaining = (int)$m['ordered_qty'] - (int)$m['delivered_other'];
            if ($qty > $remaining && !$force) {
                throw new Exception("\"{$m['product_name']}\" คีย์ได้ไม่เกินยอดคงเหลือของ SO {$m['so_number']} (เหลือ $remaining)");
            }
        }
    }

    $pdo->beginTransaction();

    if ($id > 0) {
        $stmt = $pdo->prepare('UPDATE production_delivery_notes
                               SET dn_number = ?, factory_id = ?, issued_date = ?,
                                   vehicle_note = ?, note = ?, status = ?
                               WHERE id = ?');
        $stmt->execute([$dnNumber, $factoryId, $issuedDate, $vehicleNote ?: null, $note, $status, $id]);
        $pdo->prepare('DELETE FROM production_delivery_note_items WHERE delivery_note_id = ?')->execute([$id]);
    } else {
        $stmt = $pdo->prepare('INSERT INTO production_delivery_notes
                               (dn_number, factory_id, issued_date, status, vehicle_note, note, created_by)
                               VALUES (?, ?, ?, ?, ?, ?, ?)');
        $stmt->execute([$dnNumber, $factoryId, $issuedDate, $status, $vehicleNote ?: null, $note, $userId]);
        $id = (int)$pdo->lastInsertId();
    }

    $insert = $pdo->prepare('INSERT INTO production_delivery_note_items (delivery_note_id, order_item_id, qty, note)
                             VALUES (?, ?, ?, ?)');
    foreach ($items as $item) {
        $insert->execute([$id, (int)$item['order_item_id'], (int)$item['qty'], $item['note'] ?? null]);

        /* ฟิลด์ตามใบต้นทาง -- ข้ามเองถ้ายังไม่ได้รัน migration 084 */
        $itemDoc = [];
        foreach (['doc_line_no', 'doc_sku', 'doc_name', 'unit'] as $f) {
            if (array_key_exists($f, $item) && $item[$f] !== '' && $item[$f] !== null) {
                $itemDoc[$f] = $item[$f];
            }
        }
        production_write_doc_fields($pdo, 'production_delivery_note_items', (int)$pdo->lastInsertId(), $itemDoc);
    }

    if (!empty($docFields)) {
        production_write_doc_fields($pdo, 'production_delivery_notes', $id, $docFields);
    }

    $pdo->commit();
    echo json_encode(['success' => true, 'id' => $id]);

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
