<?php
/**
 * รายการใบขน พร้อมรายการสินค้าในใบและ SO ที่ผูกอยู่
 * ใช้ทั้งแท็บ "ใบขน" และคิวรอขนย้ายของทีมคลัง (status=issued)
 */
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
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
    $userId    = isset($_GET['user_id']) ? (int)$_GET['user_id'] : 0;
    $factoryId = isset($_GET['factoryId']) ? (int)$_GET['factoryId'] : 0;
    $orderId   = isset($_GET['orderId']) ? (int)$_GET['orderId'] : 0;
    $month     = isset($_GET['month']) ? (int)$_GET['month'] : 0;
    $year      = isset($_GET['year']) ? (int)$_GET['year'] : 0;
    $status    = $_GET['status'] ?? '';
    $search    = trim($_GET['search'] ?? '');

    $where = ['1=1'];
    $params = [];

    if ($factoryId > 0) {
        $where[] = 'd.factory_id = ?';
        $params[] = $factoryId;
    }
    if ($month && $year) {
        $where[] = 'MONTH(d.issued_date) = ? AND YEAR(d.issued_date) = ?';
        $params[] = $month;
        $params[] = $year;
    } elseif ($year) {
        $where[] = 'YEAR(d.issued_date) = ?';
        $params[] = $year;
    }
    if ($status !== '') {
        $where[] = 'd.status = ?';
        $params[] = $status;
    }
    if ($orderId > 0) {
        $where[] = 'EXISTS (SELECT 1 FROM production_delivery_note_items xi
                            JOIN production_order_items xo ON xo.id = xi.order_item_id
                            WHERE xi.delivery_note_id = d.id AND xo.order_id = ?)';
        $params[] = $orderId;
    }
    if ($search !== '') {
        $where[] = '(d.dn_number LIKE ? OR EXISTS (
                        SELECT 1 FROM production_delivery_note_items xi
                        JOIN production_order_items xo ON xo.id = xi.order_item_id
                        JOIN production_orders xso ON xso.id = xo.order_id
                        WHERE xi.delivery_note_id = d.id AND xso.so_number LIKE ?
                    ))';
        $like = "%$search%";
        $params[] = $like;
        $params[] = $like;
    }

    production_apply_factory_scope($pdo, $userId, 'd', $where, $params);

    /* ฟิลด์จากใบต้นทาง (migration 084) -- ยังไม่รัน migration ก็ยังใช้งานได้ */
    $docCols = production_available_columns($pdo, 'production_delivery_notes',
        ['customer_code', 'customer_name', 'doc_receive_date', 'coordinator_name',
         'driver_name', 'driver_phone', 'driver_id_card', 'vehicle_plate',
         'source_type', 'source_file', 'source_path', 'source_size', 'imported_at']);
    $docSelect = '';
    foreach ($docCols as $c) {
        $docSelect .= ", d.`$c`";
    }
    // ชื่อคลังตามเอกสาร ตั้ง alias กันชนกับ w.name ที่ join มา
    if (in_array('warehouse_name', production_table_columns($pdo, 'production_delivery_notes'), true)) {
        $docSelect .= ', d.`warehouse_name` AS doc_warehouse_name';
    }

    $sql = 'SELECT d.id, d.dn_number, d.factory_id, d.issued_date, d.status, d.warehouse_id,
                   d.received_date, d.picked_up_at, d.vehicle_note, d.note, d.posted_to_stock,
                   d.created_by, d.created_at' . $docSelect . ',
                   f.code AS factory_code, f.name AS factory_name,
                   w.name AS warehouse_name
            FROM production_delivery_notes d
            JOIN production_factories f ON f.id = d.factory_id
            LEFT JOIN warehouses w ON w.id = d.warehouse_id
            WHERE ' . implode(' AND ', $where) . '
            ORDER BY d.issued_date DESC, d.id DESC';
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $notes = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if ($notes) {
        $ids = array_map(function ($n) { return (int)$n['id']; }, $notes);
        $ph = implode(',', array_fill(0, count($ids), '?'));
        $itemStmt = $pdo->prepare("SELECT di.id, di.delivery_note_id, di.order_item_id, di.qty,
                                          di.received_qty, di.note,
                                          i.order_id, i.ordered_qty,
                                          o.so_number,
                                          p.id AS product_id, p.sku, p.name AS product_name
                                   FROM production_delivery_note_items di
                                   JOIN production_order_items i ON i.id = di.order_item_id
                                   JOIN production_orders o ON o.id = i.order_id
                                   JOIN stock_arrival_products p ON p.id = i.product_id
                                   WHERE di.delivery_note_id IN ($ph)
                                   ORDER BY p.name");
        $itemStmt->execute($ids);

        $byNote = [];
        foreach ($itemStmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
            $byNote[(int)$r['delivery_note_id']][] = $r;
        }
        foreach ($notes as &$n) {
            $items = $byNote[(int)$n['id']] ?? [];
            $n['items'] = $items;
            $n['total_qty'] = array_sum(array_map(function ($i) { return (int)$i['qty']; }, $items));
            $n['total_received_qty'] = array_sum(array_map(function ($i) {
                return $i['received_qty'] === null ? (int)$i['qty'] : (int)$i['received_qty'];
            }, $items));
            $n['so_numbers'] = array_values(array_unique(array_map(function ($i) {
                return $i['so_number'];
            }, $items)));
        }
        unset($n);
    }

    echo json_encode(['success' => true, 'data' => $notes]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
