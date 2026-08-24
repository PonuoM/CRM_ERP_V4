<?php
// เพิ่ม/แก้ไขโรงงานผลิต (หน้าตั้งค่า)
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
    if (!$input) {
        throw new Exception('Invalid input');
    }

    $userId = $input['user_id'] ?? null;
    production_require_manage($pdo, $userId);

    $id = isset($input['id']) ? (int)$input['id'] : 0;
    $code = trim($input['code'] ?? '');
    $name = trim($input['name'] ?? '');
    $note = trim($input['note'] ?? '');
    $sortOrder = (int)($input['sort_order'] ?? 0);
    $isActive = isset($input['is_active']) ? (int)!!$input['is_active'] : 1;

    if ($code === '' || $name === '') {
        throw new Exception('ต้องระบุรหัสและชื่อโรงงาน');
    }

    // รหัสโรงงานห้ามซ้ำ
    $dup = $pdo->prepare('SELECT id FROM production_factories WHERE code = ? AND id <> ? LIMIT 1');
    $dup->execute([$code, $id]);
    if ($dup->fetchColumn()) {
        throw new Exception("รหัสโรงงาน \"$code\" ถูกใช้ไปแล้ว");
    }

    if ($id > 0) {
        $stmt = $pdo->prepare('UPDATE production_factories
                               SET code = ?, name = ?, note = ?, sort_order = ?, is_active = ?
                               WHERE id = ?');
        $stmt->execute([$code, $name, $note ?: null, $sortOrder, $isActive, $id]);
    } else {
        $stmt = $pdo->prepare('INSERT INTO production_factories (code, name, note, sort_order, is_active, created_by)
                               VALUES (?, ?, ?, ?, ?, ?)');
        $stmt->execute([$code, $name, $note ?: null, $sortOrder, $isActive, $userId]);
        $id = (int)$pdo->lastInsertId();
    }

    echo json_encode(['success' => true, 'id' => $id]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
