<?php
// ให้/ถอนสิทธิ์ "เพิ่ม-ลบแพลน + เพิ่มหมายเหตุ" ของบัญชีหนึ่ง
// ทำได้เฉพาะ Super Admin / Admin Control / CEO
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once '../config.php';
require_once 'stock_plan_permission.php';
$pdo = db_connect();

try {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!is_array($input)) {
        throw new Exception('Invalid input');
    }
    $targetId = (int)($input['user_id'] ?? 0);
    $canManage = !empty($input['can_manage']);
    $actorId = isset($input['actor_user_id']) ? (int)$input['actor_user_id'] : 0;

    if ($targetId <= 0) {
        throw new Exception('Missing user id');
    }

    if (!stock_plan_can_grant($pdo, $actorId)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'ไม่มีสิทธิ์ตั้งค่าสิทธิ์ให้บัญชีอื่น']);
        exit;
    }

    $targetRole = stock_plan_user_role($pdo, $targetId);
    if ($targetRole === null) {
        throw new Exception('ไม่พบบัญชีนี้');
    }
    if (in_array($targetRole, STOCK_PLAN_ADMIN_ROLES, true)) {
        throw new Exception('บัญชีนี้เป็นผู้ดูแลระดับสูง (' . $targetRole . ') มีสิทธิ์อยู่แล้วโดยอัตโนมัติ');
    }

    if ($canManage) {
        $stmt = $pdo->prepare('INSERT INTO stock_arrival_plan_managers (user_id, can_manage, granted_by)
                                VALUES (?, 1, ?)
                                ON DUPLICATE KEY UPDATE can_manage = 1, granted_by = VALUES(granted_by)');
        $stmt->execute([$targetId, $actorId ?: null]);
    } else {
        $pdo->prepare('DELETE FROM stock_arrival_plan_managers WHERE user_id = ?')->execute([$targetId]);
    }

    echo json_encode(['success' => true, 'user_id' => $targetId, 'can_manage' => $canManage]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
