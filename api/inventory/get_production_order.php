<?php
// SO ใบเดียว พร้อมรายการสินค้า ยอดคงเหลือ และใบขนที่ผูกอยู่
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
    $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
    $userId = isset($_GET['user_id']) ? (int)$_GET['user_id'] : 0;
    if ($id <= 0) {
        throw new Exception('Missing order id');
    }

    $stmt = $pdo->prepare('SELECT o.*, f.code AS factory_code, f.name AS factory_name, c.name AS company_name
                           FROM production_orders o
                           JOIN production_factories f ON f.id = o.factory_id
                           LEFT JOIN companies c ON c.id = o.company_id
                           WHERE o.id = ? LIMIT 1');
    $stmt->execute([$id]);
    $order = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$order) {
        throw new Exception('ไม่พบ SO ที่ระบุ');
    }

    // บัญชีที่ถูกล็อกโรงงานเปิดดู SO ของโรงงานอื่นไม่ได้
    $visible = production_visible_factory_ids($pdo, $userId);
    if (!empty($visible) && !in_array((int)$order['factory_id'], $visible, true)) {
        throw new Exception('ไม่มีสิทธิ์ดู SO ของโรงงานนี้');
    }

    $withItems = production_attach_items($pdo, [$order]);
    $order = $withItems[0];

    // ใบขนที่แตะ SO ใบนี้
    $dnStmt = $pdo->prepare("SELECT d.id, d.dn_number, d.issued_date, d.status, d.received_date,
                                    d.vehicle_note, d.note, d.warehouse_id, w.name AS warehouse_name,
                                    SUM(di.qty) AS qty,
                                    SUM(COALESCE(di.received_qty, di.qty)) AS received_qty
                             FROM production_delivery_notes d
                             JOIN production_delivery_note_items di ON di.delivery_note_id = d.id
                             JOIN production_order_items i ON i.id = di.order_item_id
                             LEFT JOIN warehouses w ON w.id = d.warehouse_id
                             WHERE i.order_id = ?
                             GROUP BY d.id, d.dn_number, d.issued_date, d.status, d.received_date,
                                      d.vehicle_note, d.note, d.warehouse_id, w.name
                             ORDER BY d.issued_date DESC, d.id DESC");
    $dnStmt->execute([$id]);
    $order['delivery_notes'] = $dnStmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(['success' => true, 'data' => $order]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
