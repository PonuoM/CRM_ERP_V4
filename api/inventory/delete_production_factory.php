<?php
// ลบโรงงานผลิต — ลบได้เฉพาะโรงงานที่ยังไม่มี SO/ใบขนผูกอยู่ (ที่เหลือให้ปิด is_active แทน)
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
        throw new Exception('Missing factory id');
    }

    $chk = $pdo->prepare('SELECT
            (SELECT COUNT(*) FROM production_orders WHERE factory_id = ?) AS so_count,
            (SELECT COUNT(*) FROM production_delivery_notes WHERE factory_id = ?) AS dn_count');
    $chk->execute([$id, $id]);
    $counts = $chk->fetch(PDO::FETCH_ASSOC);
    if ((int)$counts['so_count'] > 0 || (int)$counts['dn_count'] > 0) {
        throw new Exception('โรงงานนี้มี SO หรือใบขนผูกอยู่แล้ว ลบไม่ได้ — ให้ปิดใช้งานแทน');
    }

    $stmt = $pdo->prepare('DELETE FROM production_factories WHERE id = ?');
    $stmt->execute([$id]);

    echo json_encode(['success' => true]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
