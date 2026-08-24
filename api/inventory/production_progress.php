<?php
/**
 * คำนวณยอดคงเหลือฝั่งโรงงานของ SO สั่งผลิต
 *
 * ที่นี่คือแหล่งความจริงเดียวของสูตรบาลานซ์ — endpoint อื่นห้ามคำนวณเอง
 *   pending (ยังไม่ผลิต)     = ordered - delivered
 *   waiting (ผลิตเสร็จรอขน)  = ใบขนสถานะ issued
 *   picked  (เข้าคลังแล้ว)   = ใบขนสถานะ picked_up
 *   shortage (ของมาไม่ครบ)   = qty ตามใบขน - received_qty ที่คลังรับจริง
 */

/**
 * ยอดคงเหลือรายบรรทัดของ SO (key = order_item_id)
 *
 * @param int[] $orderIds
 */
function production_item_rows(PDO $pdo, array $orderIds): array
{
    if (empty($orderIds)) {
        return [];
    }
    $ph = implode(',', array_fill(0, count($orderIds), '?'));
    // ฟิลด์จากใบ SO ต้นทาง (migration 084) -- ยังไม่รัน migration ก็ไม่พัง
    $docCols = production_available_columns($pdo, 'production_order_items',
        ['doc_line_no', 'doc_sku', 'doc_name', 'unit', 'department']);
    $docSelect = '';
    foreach ($docCols as $c) {
        $docSelect .= ", i.`$c`";
    }
    $sql = "SELECT i.id, i.order_id, i.product_id, i.ordered_qty, i.note$docSelect,
                   p.sku, p.name AS product_name, p.format_code,
                   COALESCE(SUM(CASE WHEN d.status <> 'cancelled' THEN di.qty END), 0) AS delivered_qty,
                   COALESCE(SUM(CASE WHEN d.status = 'issued' THEN di.qty END), 0) AS waiting_qty,
                   COALESCE(SUM(CASE WHEN d.status = 'picked_up' THEN di.qty END), 0) AS picked_qty,
                   COALESCE(SUM(CASE WHEN d.status = 'picked_up' THEN COALESCE(di.received_qty, di.qty) END), 0) AS received_qty
            FROM production_order_items i
            JOIN stock_arrival_products p ON p.id = i.product_id
            LEFT JOIN production_delivery_note_items di ON di.order_item_id = i.id
            LEFT JOIN production_delivery_notes d ON d.id = di.delivery_note_id
            WHERE i.order_id IN ($ph)
            GROUP BY i.id, i.order_id, i.product_id, i.ordered_qty, i.note$docSelect, p.sku, p.name, p.format_code
            ORDER BY p.name";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($orderIds);

    $rows = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
        $ordered  = (int)$r['ordered_qty'];
        $delivered = (int)$r['delivered_qty'];
        $waiting  = (int)$r['waiting_qty'];
        $picked   = (int)$r['picked_qty'];
        $received = (int)$r['received_qty'];

        $rows[] = [
            'id'           => (int)$r['id'],
            'order_id'     => (int)$r['order_id'],
            'product_id'   => (int)$r['product_id'],
            'sku'          => $r['sku'],
            'product_name' => $r['product_name'],
            'format_code'  => $r['format_code'],
            'note'         => $r['note'],
            'ordered_qty'  => $ordered,
            'delivered_qty' => $delivered,
            // ยอดติดลบเป็นไปได้เฉพาะกรณี Super Admin คีย์ใบขนเกินยอด SO — ปล่อยให้เห็นเพื่อจะได้รู้ว่าผิด
            'pending_qty'  => $ordered - $delivered,
            'waiting_qty'  => $waiting,
            'picked_qty'   => $picked,
            'received_qty' => $received,
            'shortage_qty' => $picked - $received,
        ];
        foreach ($docCols as $c) {
            $rows[count($rows) - 1][$c] = $r[$c];
        }
    }
    return $rows;
}

/**
 * สถานะความคืบหน้าของ SO (คำนวณสด ไม่เก็บใน DB)
 *   not_started    ยังไม่ออกใบขนเลย
 *   producing      ออกใบขนบางส่วน ยังผลิตไม่ครบ
 *   waiting_pickup ผลิตครบแล้ว เหลือรอ Airport มารับ
 *   completed      เข้าคลังครบแล้ว
 *   closed         ปิดยอดเอง (ผลิตไม่ครบแล้วเลิก)
 *   cancelled      ยกเลิก
 */
function production_progress_status(string $dbStatus, int $pending, int $waiting, int $delivered): string
{
    if ($dbStatus === 'cancelled') return 'cancelled';
    if ($dbStatus === 'closed')    return 'closed';
    if ($pending > 0)              return $delivered > 0 ? 'producing' : 'not_started';
    if ($waiting > 0)              return 'waiting_pickup';
    return 'completed';
}

/**
 * แปะรายการสินค้า + ยอดรวมระดับ SO ให้ทุกใบใน $orders
 */
function production_attach_items(PDO $pdo, array $orders): array
{
    if (empty($orders)) {
        return [];
    }
    $orderIds = array_map(function ($o) { return (int)$o['id']; }, $orders);
    $itemRows = production_item_rows($pdo, $orderIds);

    $byOrder = [];
    foreach ($itemRows as $row) {
        $byOrder[$row['order_id']][] = $row;
    }

    $out = [];
    foreach ($orders as $o) {
        $items = $byOrder[(int)$o['id']] ?? [];
        $totals = [
            'ordered_qty' => 0, 'delivered_qty' => 0, 'pending_qty' => 0,
            'waiting_qty' => 0, 'picked_qty' => 0, 'received_qty' => 0, 'shortage_qty' => 0,
        ];
        foreach ($items as $it) {
            foreach ($totals as $k => $_) {
                $totals[$k] += $it[$k];
            }
        }
        $o['items'] = $items;
        $o['totals'] = $totals;
        $o['progress_status'] = production_progress_status(
            $o['status'], $totals['pending_qty'], $totals['waiting_qty'], $totals['delivered_qty']
        );
        $out[] = $o;
    }
    return $out;
}

/**
 * คอลัมน์ที่ตารางมีอยู่จริง (cache ต่อ 1 request)
 *
 * เมนูนี้ทีมเป็นคน deploy โค้ดเอง ลำดับ "ขึ้นโค้ด" กับ "รัน migration" จึงสลับกันได้
 * ฟิลด์ที่มาจากเอกสาร PDF (migration 084) เลยต้องเขียนแบบไม่พังถ้าคอลัมน์ยังไม่มี
 */
function production_table_columns(PDO $pdo, string $table): array
{
    static $cache = [];
    if (!array_key_exists($table, $cache)) {
        $stmt = $pdo->prepare('SELECT COLUMN_NAME FROM information_schema.COLUMNS
                               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?');
        $stmt->execute([$table]);
        $cache[$table] = array_map('strval', $stmt->fetchAll(PDO::FETCH_COLUMN));
    }
    return $cache[$table];
}

/** เอาเฉพาะชื่อคอลัมน์ที่มีจริง */
function production_available_columns(PDO $pdo, string $table, array $wanted): array
{
    $have = production_table_columns($pdo, $table);
    return array_values(array_intersect($wanted, $have));
}

/**
 * เขียนฟิลด์จากเอกสารลงแถวเดียว -- ข้ามคอลัมน์ที่ยังไม่มี และไม่ทำอะไรถ้าไม่มีค่าเลย
 *
 * @param array<string,mixed> $data ชื่อคอลัมน์ => ค่า
 */
function production_write_doc_fields(PDO $pdo, string $table, int $id, array $data): void
{
    if ($id <= 0 || empty($data)) {
        return;
    }
    $cols = production_available_columns($pdo, $table, array_keys($data));
    if (empty($cols)) {
        return;
    }
    $set = [];
    $vals = [];
    foreach ($cols as $col) {
        $set[] = "`$col` = ?";
        $vals[] = $data[$col];
    }
    $vals[] = $id;
    $stmt = $pdo->prepare("UPDATE `$table` SET " . implode(', ', $set) . ' WHERE id = ?');
    $stmt->execute($vals);
}
