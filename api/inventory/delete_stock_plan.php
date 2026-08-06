<?php
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
    $planId = (int)($input['id'] ?? 0);
    $force = !empty($input['force']); // emergency override -- Super Admin เท่านั้น (ดูด้านล่าง)
    $userId = isset($input['user_id']) ? (int)$input['user_id'] : 0;
    if (!$planId) {
        throw new Exception('Missing plan id');
    }

    // ลบแพลนได้เฉพาะบัญชีที่ได้รับสิทธิ์ (ตั้งค่าที่แท็บ "สิทธิ์การจัดการ")
    stock_plan_require_manage($pdo, $userId);

    // ข้ามด่าน "ห้ามลบแพลนที่ยืนยันรับเข้าแล้ว" ได้เฉพาะ Super Admin
    if ($force && !stock_plan_is_super_admin($pdo, $userId)) {
        $force = false;
    }

    $pdo->beginTransaction();

    if (!$force) {
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM stock_arrival_plan_expectations e
                                JOIN stock_arrival_plan_items i ON e.item_id = i.id
                                WHERE i.plan_id = ? AND e.status != 'expected'");
        $stmt->execute([$planId]);
        if ((int)$stmt->fetchColumn() > 0) {
            throw new Exception('Cannot delete a plan that already has confirmed items');
        }
    }

    // Cascades to items then expectations via FK
    $pdo->prepare("DELETE FROM stock_arrival_plans WHERE id = ?")->execute([$planId]);

    $pdo->commit();
    echo json_encode(['success' => true]);

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
