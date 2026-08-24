<?php
/**
 * ตั้งสิทธิ์ระบบสั่งผลิตให้บัญชีหนึ่ง — ทำได้เฉพาะ Super Admin / Admin Control / CEO
 *
 * can_manage  : แก้ไขข้อมูลได้ (ตุ๊กตา ฯลฯ)
 * factory_ids : ล็อกให้เห็นเฉพาะโรงงานที่ระบุ (บัญชี read-only ฝั่งโรงงาน)
 *               ส่ง [] = เห็นทุกโรงงาน (ทีมคลัง Airport)
 *               ไม่ส่งฟิลด์นี้มาเลย = ไม่แตะขอบเขตโรงงานเดิม
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
    if (!is_array($input)) {
        throw new Exception('Invalid input');
    }
    $targetId = (int)($input['user_id'] ?? 0);
    $actorId = isset($input['actor_user_id']) ? (int)$input['actor_user_id'] : 0;

    if ($targetId <= 0) {
        throw new Exception('Missing user id');
    }
    if (!production_can_grant($pdo, $actorId)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'ไม่มีสิทธิ์ตั้งค่าสิทธิ์ให้บัญชีอื่น']);
        exit;
    }

    $targetRole = production_user_role($pdo, $targetId);
    if ($targetRole === null) {
        throw new Exception('ไม่พบบัญชีนี้');
    }

    $pdo->beginTransaction();

    if (array_key_exists('can_manage', $input)) {
        if (in_array($targetRole, PRODUCTION_ADMIN_ROLES, true)) {
            throw new Exception('บัญชีนี้เป็นผู้ดูแลระดับสูง (' . $targetRole . ') มีสิทธิ์อยู่แล้วโดยอัตโนมัติ');
        }
        if (!empty($input['can_manage'])) {
            $stmt = $pdo->prepare('INSERT INTO production_managers (user_id, can_manage, granted_by)
                                   VALUES (?, 1, ?)
                                   ON DUPLICATE KEY UPDATE can_manage = 1, granted_by = VALUES(granted_by)');
            $stmt->execute([$targetId, $actorId ?: null]);
        } else {
            $pdo->prepare('DELETE FROM production_managers WHERE user_id = ?')->execute([$targetId]);
        }
    }

    if (array_key_exists('factory_ids', $input)) {
        $factoryIds = array_values(array_unique(array_map('intval', (array)$input['factory_ids'])));
        $pdo->prepare('DELETE FROM production_user_factories WHERE user_id = ?')->execute([$targetId]);
        if (!empty($factoryIds)) {
            $ins = $pdo->prepare('INSERT INTO production_user_factories (user_id, factory_id, granted_by)
                                  VALUES (?, ?, ?)');
            foreach ($factoryIds as $fid) {
                if ($fid > 0) {
                    $ins->execute([$targetId, $fid, $actorId ?: null]);
                }
            }
        }
    }

    $pdo->commit();
    echo json_encode(['success' => true, 'user_id' => $targetId]);

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
