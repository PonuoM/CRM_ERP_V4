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

/**
 * ยกเลิกการกำหนดวันที่คาดว่าจะเข้าของสินค้ารายการเดียว
 * จำนวนจะเด้งกลับไปเป็น "รอกำหนดวันที่คาดว่าจะเข้า" ของ item เดิม (ยอดแพลนไม่หาย)
 *
 * ลบได้เฉพาะแถวที่ยังเป็น 'expected' — ที่ยืนยันรับเข้าแล้วคือของที่เข้าคลังจริง ห้ามลบ
 */
try {
    $input = json_decode(file_get_contents('php://input'), true);
    $expectationId = (int)($input['id'] ?? 0);
    $userId = $input['user_id'] ?? null;
    if (!$expectationId) {
        throw new Exception('Missing expectation id');
    }

    stock_plan_require_manage($pdo, $userId);

    $pdo->beginTransaction();

    $stmt = $pdo->prepare("SELECT status FROM stock_arrival_plan_expectations WHERE id = ? FOR UPDATE");
    $stmt->execute([$expectationId]);
    $status = $stmt->fetchColumn();
    if ($status === false) {
        throw new Exception('ไม่พบรายการที่ต้องการลบ');
    }
    if ($status !== 'expected') {
        throw new Exception('รายการนี้ยืนยันรับเข้า/ปิดเคสไปแล้ว ลบไม่ได้');
    }

    // ถ้าแถวนี้เกิดจากการเลื่อนยอดที่ขาด แถวต้นทางจะชี้มาที่นี่ผ่าน next_expectation_id
    // FK เป็น ON DELETE SET NULL อยู่แล้ว — ต้นทางจะกลายเป็น "ยืนยันแล้วแต่ไม่มีคิวเลื่อนต่อ"
    $pdo->prepare("DELETE FROM stock_arrival_plan_expectations WHERE id = ?")->execute([$expectationId]);

    $pdo->commit();
    echo json_encode(['success' => true]);

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
