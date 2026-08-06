<?php
// เพิ่มหมายเหตุ 1 บรรทัดเข้าไทม์ไลน์ของแพลน — ต้องมีสิทธิ์จัดการ (ดู stock_plan_permission.php)
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
    $planId = (int)($input['plan_id'] ?? 0);
    $note = trim($input['note'] ?? '');
    $userId = isset($input['user_id']) ? (int)$input['user_id'] : 0;

    if ($planId <= 0) {
        throw new Exception('Missing plan id');
    }
    if ($note === '') {
        throw new Exception('กรุณาพิมพ์หมายเหตุ');
    }
    if (mb_strlen($note) > 2000) {
        throw new Exception('หมายเหตุยาวเกินไป (จำกัด 2000 ตัวอักษร)');
    }

    stock_plan_require_manage($pdo, $userId);

    $stmt = $pdo->prepare('SELECT id FROM stock_arrival_plans WHERE id = ? LIMIT 1');
    $stmt->execute([$planId]);
    if (!$stmt->fetchColumn()) {
        throw new Exception('ไม่พบแพลนนี้');
    }

    $stmt = $pdo->prepare('INSERT INTO stock_arrival_plan_notes (plan_id, note, created_by) VALUES (?, ?, ?)');
    $stmt->execute([$planId, $note, $userId ?: null]);

    echo json_encode(['success' => true, 'id' => (int)$pdo->lastInsertId()]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
