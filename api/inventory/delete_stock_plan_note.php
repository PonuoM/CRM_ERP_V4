<?php
// ลบหมายเหตุ — ลบได้เฉพาะคนที่พิมพ์เอง (Super Admin ลบแทนได้ในกรณีฉุกเฉิน)
// เป็น soft delete: แถวยังอยู่ในฐานข้อมูลพร้อม deleted_at/deleted_by เพื่อให้ตรวจย้อนหลังได้
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
    $noteId = (int)($input['id'] ?? 0);
    $userId = isset($input['user_id']) ? (int)$input['user_id'] : 0;

    if ($noteId <= 0) {
        throw new Exception('Missing note id');
    }

    $stmt = $pdo->prepare('SELECT created_by, deleted_at FROM stock_arrival_plan_notes WHERE id = ? LIMIT 1');
    $stmt->execute([$noteId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) {
        throw new Exception('ไม่พบหมายเหตุนี้');
    }
    if ($row['deleted_at'] !== null) {
        echo json_encode(['success' => true]); // ลบไปแล้ว — ถือว่าสำเร็จ
        exit;
    }

    $isOwner = $userId > 0 && (int)$row['created_by'] === $userId;
    if (!$isOwner && !stock_plan_is_super_admin($pdo, $userId)) {
        throw new Exception('ลบได้เฉพาะหมายเหตุที่ตัวเองเป็นคนบันทึก');
    }

    $stmt = $pdo->prepare('UPDATE stock_arrival_plan_notes SET deleted_at = NOW(), deleted_by = ? WHERE id = ?');
    $stmt->execute([$userId ?: null, $noteId]);

    echo json_encode(['success' => true]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
