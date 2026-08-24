<?php
// ลบใบขน — ใบที่รับเข้าคลังแล้วลบได้เฉพาะ Super Admin (ปกติให้ใช้สถานะ "ยกเลิก" แทนเพื่อเก็บประวัติ)
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
        throw new Exception('Missing delivery note id');
    }

    $cur = $pdo->prepare('SELECT status FROM production_delivery_notes WHERE id = ? LIMIT 1');
    $cur->execute([$id]);
    $status = $cur->fetchColumn();
    if ($status === false) {
        throw new Exception('ไม่พบใบขนที่ระบุ');
    }
    if ($status === 'picked_up' && !production_is_super_admin($pdo, $userId)) {
        throw new Exception('ใบขนนี้รับเข้าคลังแล้ว ลบไม่ได้ — ให้ถอนการรับเข้าก่อน');
    }

    $pdo->beginTransaction();
    $pdo->prepare('DELETE FROM production_delivery_note_items WHERE delivery_note_id = ?')->execute([$id]);
    $pdo->prepare('DELETE FROM production_delivery_notes WHERE id = ?')->execute([$id]);
    $pdo->commit();

    echo json_encode(['success' => true]);

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
