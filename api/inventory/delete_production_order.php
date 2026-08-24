<?php
// ลบ SO สั่งผลิต — ลบไม่ได้ถ้ามีใบขนผูกอยู่ (ให้ยกเลิกใบขนก่อน หรือใช้สถานะ cancelled แทน)
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
    $id = isset($input['id']) ? (int)$input['id'] : 0;
    $userId = $input['user_id'] ?? null;

    production_require_manage($pdo, $userId);
    if ($id <= 0) {
        throw new Exception('Missing order id');
    }

    $chk = $pdo->prepare('SELECT COUNT(*)
                          FROM production_delivery_note_items di
                          JOIN production_order_items i ON i.id = di.order_item_id
                          WHERE i.order_id = ?');
    $chk->execute([$id]);
    if ((int)$chk->fetchColumn() > 0) {
        throw new Exception('SO นี้มีใบขนผูกอยู่แล้ว ลบไม่ได้ — ให้ยกเลิกใบขนก่อน หรือเปลี่ยนสถานะ SO เป็น "ยกเลิก"');
    }

    $pdo->beginTransaction();
    $pdo->prepare('DELETE FROM production_order_items WHERE order_id = ?')->execute([$id]);
    $pdo->prepare('DELETE FROM production_orders WHERE id = ?')->execute([$id]);
    $pdo->commit();

    echo json_encode(['success' => true]);

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
