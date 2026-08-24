<?php
/**
 * เปิด/แก้ไข SO สั่งผลิต (ตุ๊กตาคีย์ตามใบ SO จาก e-acc)
 *
 * กติกาที่กันไว้:
 *  - เลข SO ห้ามซ้ำ (unique ใน DB อีกชั้น)
 *  - ยอดของบรรทัดที่ออกใบขนไปแล้ว ห้ามลดต่ำกว่ายอดที่ออกใบขนไป และห้ามลบบรรทัดทิ้ง
 *    (Super Admin ข้ามได้ด้วย force = true)
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

/** เก็บข้อมูลบรรทัดตามใบต้นทาง (รหัส/ชื่อ/หน่วย/ฝ่ายผลิตตามเอกสาร) */
function production_write_item_doc_fields(PDO $pdo, int $itemId, array $item): void
{
    $data = [];
    foreach (['doc_line_no', 'doc_sku', 'doc_name', 'unit', 'department'] as $f) {
        if (array_key_exists($f, $item) && $item[$f] !== '' && $item[$f] !== null) {
            $data[$f] = $item[$f];
        }
    }
    production_write_doc_fields($pdo, 'production_order_items', $itemId, $data);
}

try {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input) {
        throw new Exception('Invalid input');
    }

    $userId = $input['user_id'] ?? null;
    production_require_manage($pdo, $userId);

    $id          = isset($input['id']) ? (int)$input['id'] : 0;
    $soNumber    = trim($input['so_number'] ?? '');
    $companyId   = isset($input['company_id']) ? (int)$input['company_id'] : null;
    $factoryId   = isset($input['factory_id']) ? (int)$input['factory_id'] : 0;
    $soDate      = $input['so_date'] ?? null;
    $periodStart = $input['period_start'] ?? null;
    $periodEnd   = $input['period_end'] ?? null;
    $dueDate     = $input['due_date'] ?? null;
    $status      = $input['status'] ?? 'open';
    $notes       = $input['notes'] ?? '';
    $items       = $input['items'] ?? [];
    $force       = !empty($input['force']) && production_is_super_admin($pdo, $userId);

    /* ฟิลด์ที่มาจากใบ SO ต้นทาง (PDF จาก e-acc) -- ส่งมาเฉพาะตอนนำเข้าไฟล์ */
    $docFields = [];
    foreach (['customer_code', 'customer_name', 'customer_address', 'receive_date',
              'warehouse_name', 'coordinator_name', 'source_type', 'source_file',
              'source_path', 'source_size'] as $f) {
        if (array_key_exists($f, $input)) {
            $docFields[$f] = ($input[$f] === '' ? null : $input[$f]);
        }
    }
    if (($docFields['source_type'] ?? '') === 'pdf') {
        $docFields['imported_at'] = date('Y-m-d H:i:s');
    }

    if ($soNumber === '')  throw new Exception('ต้องระบุเลข SO');
    if ($factoryId <= 0)   throw new Exception('ต้องเลือกโรงงานผลิต');
    if (empty($soDate))    throw new Exception('ต้องระบุวันที่ SO');
    if (empty($items))     throw new Exception('ต้องมีรายการสินค้าอย่างน้อย 1 รายการ');
    if (!in_array($status, ['open', 'closed', 'cancelled'], true)) {
        throw new Exception('สถานะไม่ถูกต้อง');
    }

    foreach ($items as $item) {
        if (empty($item['product_id']) || (int)($item['ordered_qty'] ?? 0) <= 0) {
            throw new Exception('รายการสินค้าไม่ถูกต้อง (ต้องเลือกสินค้าและใส่จำนวนมากกว่า 0)');
        }
    }

    // เลข SO ห้ามซ้ำ
    $dup = $pdo->prepare('SELECT id FROM production_orders WHERE so_number = ? AND id <> ? LIMIT 1');
    $dup->execute([$soNumber, $id]);
    if ($dup->fetchColumn()) {
        throw new Exception("เลข SO \"$soNumber\" ถูกคีย์เข้าระบบไปแล้ว");
    }

    $pdo->beginTransaction();

    if ($id > 0) {
        $cur = $pdo->prepare('SELECT status FROM production_orders WHERE id = ? LIMIT 1');
        $cur->execute([$id]);
        $curStatus = $cur->fetchColumn();
        if ($curStatus === false) {
            throw new Exception('ไม่พบ SO ที่จะแก้ไข');
        }

        // ยอดที่ออกใบขนไปแล้วของแต่ละบรรทัด — ใช้กันการแก้ยอดย้อนหลังจนตัวเลขเพี้ยน
        $delStmt = $pdo->prepare("SELECT di.order_item_id, SUM(di.qty) AS delivered
                                  FROM production_delivery_note_items di
                                  JOIN production_delivery_notes d ON d.id = di.delivery_note_id
                                  JOIN production_order_items i ON i.id = di.order_item_id
                                  WHERE i.order_id = ? AND d.status <> 'cancelled'
                                  GROUP BY di.order_item_id");
        $delStmt->execute([$id]);
        $delivered = [];
        foreach ($delStmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
            $delivered[(int)$r['order_item_id']] = (int)$r['delivered'];
        }

        $closedAt = null;
        $closedBy = null;
        if ($status !== 'open' && $curStatus === 'open') {
            $closedAt = date('Y-m-d H:i:s');
            $closedBy = $userId;
        } elseif ($status === 'open') {
            $closedAt = null;
            $closedBy = null;
        } else {
            $keep = $pdo->prepare('SELECT closed_at, closed_by FROM production_orders WHERE id = ?');
            $keep->execute([$id]);
            $row = $keep->fetch(PDO::FETCH_ASSOC);
            $closedAt = $row['closed_at'];
            $closedBy = $row['closed_by'];
        }

        $stmt = $pdo->prepare('UPDATE production_orders
                               SET so_number = ?, company_id = ?, factory_id = ?, so_date = ?,
                                   period_start = ?, period_end = ?, due_date = ?, status = ?,
                                   notes = ?, closed_at = ?, closed_by = ?
                               WHERE id = ?');
        $stmt->execute([
            $soNumber, $companyId ?: null, $factoryId, $soDate,
            $periodStart ?: null, $periodEnd ?: null, $dueDate ?: null, $status,
            $notes, $closedAt, $closedBy, $id,
        ]);

        // บรรทัดที่หายไปจาก payload = ถูกลบ
        $existing = $pdo->prepare('SELECT id FROM production_order_items WHERE order_id = ?');
        $existing->execute([$id]);
        $existingIds = array_map('intval', $existing->fetchAll(PDO::FETCH_COLUMN));
        $keptIds = [];

        $insert = $pdo->prepare('INSERT INTO production_order_items (order_id, product_id, ordered_qty, note)
                                 VALUES (?, ?, ?, ?)');
        $update = $pdo->prepare('UPDATE production_order_items
                                 SET product_id = ?, ordered_qty = ?, note = ? WHERE id = ? AND order_id = ?');

        foreach ($items as $item) {
            $itemId = isset($item['id']) ? (int)$item['id'] : 0;
            $qty = (int)$item['ordered_qty'];
            $note = $item['note'] ?? null;

            if ($itemId > 0 && in_array($itemId, $existingIds, true)) {
                $already = $delivered[$itemId] ?? 0;
                if (!$force && $qty < $already) {
                    throw new Exception("ลดยอดต่ำกว่าที่ออกใบขนไปแล้วไม่ได้ (ออกใบขนแล้ว $already)");
                }
                $update->execute([$item['product_id'], $qty, $note, $itemId, $id]);
                production_write_item_doc_fields($pdo, $itemId, $item);
                $keptIds[] = $itemId;
            } else {
                $insert->execute([$id, $item['product_id'], $qty, $note]);
                production_write_item_doc_fields($pdo, (int)$pdo->lastInsertId(), $item);
            }
        }

        foreach (array_diff($existingIds, $keptIds) as $removedId) {
            if (!$force && !empty($delivered[$removedId])) {
                throw new Exception('ลบรายการที่ออกใบขนไปแล้วไม่ได้ — ให้ยกเลิกใบขนก่อน');
            }
            $del = $pdo->prepare('DELETE FROM production_order_items WHERE id = ? AND order_id = ?');
            $del->execute([$removedId, $id]);
        }

    } else {
        $stmt = $pdo->prepare('INSERT INTO production_orders
                               (so_number, company_id, factory_id, so_date, period_start, period_end,
                                due_date, status, notes, created_by)
                               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        $stmt->execute([
            $soNumber, $companyId ?: null, $factoryId, $soDate,
            $periodStart ?: null, $periodEnd ?: null, $dueDate ?: null, $status, $notes, $userId,
        ]);
        $id = (int)$pdo->lastInsertId();

        $insert = $pdo->prepare('INSERT INTO production_order_items (order_id, product_id, ordered_qty, note)
                                 VALUES (?, ?, ?, ?)');
        foreach ($items as $item) {
            $insert->execute([$id, $item['product_id'], (int)$item['ordered_qty'], $item['note'] ?? null]);
            production_write_item_doc_fields($pdo, (int)$pdo->lastInsertId(), $item);
        }
    }

    if (!empty($docFields)) {
        production_write_doc_fields($pdo, 'production_orders', $id, $docFields);
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
