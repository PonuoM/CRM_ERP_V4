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
 * แก้ไขรายการ "คาดว่าจะเข้า" ทีละสินค้า — เลื่อนวัน / แก้จำนวน / แก้เลข SO
 *
 * แก้ได้เฉพาะแถวที่ยังเป็น status = 'expected' เท่านั้น
 * แถวที่ยืนยันรับเข้า/ปิดเคสไปแล้ว = ประวัติของจริง ห้ามแก้ผ่านช่องทางนี้
 */
try {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input || empty($input['id'])) {
        throw new Exception('Invalid input');
    }

    $expectationId = (int)$input['id'];
    $expectedQty = (int)($input['expected_qty'] ?? 0);
    $expectedDate = $input['expected_date'] ?? null;
    $soNumber = isset($input['so_number']) ? trim((string)$input['so_number']) : null;
    $userId = $input['user_id'] ?? null;

    // เกณฑ์สิทธิ์เดียวกับเพิ่ม/แก้/ลบแพลน
    stock_plan_require_manage($pdo, $userId);

    if (empty($expectedDate)) {
        throw new Exception('กรุณาระบุวันที่คาดว่าจะเข้า');
    }
    if ($expectedQty <= 0) {
        throw new Exception('จำนวนต้องมากกว่า 0');
    }

    $pdo->beginTransaction();

    $stmt = $pdo->prepare("SELECT e.id, e.item_id, e.expected_qty, e.status, i.planned_qty
                            FROM stock_arrival_plan_expectations e
                            JOIN stock_arrival_plan_items i ON e.item_id = i.id
                            WHERE e.id = ? FOR UPDATE");
    $stmt->execute([$expectationId]);
    $expectation = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$expectation) {
        throw new Exception('ไม่พบรายการที่ต้องการแก้ไข');
    }
    if ($expectation['status'] !== 'expected') {
        throw new Exception('รายการนี้ยืนยันรับเข้า/ปิดเคสไปแล้ว แก้ไขไม่ได้');
    }

    // เพดานจำนวน = ยอดแพลนของสินค้านี้ ลบด้วยที่กำหนดวันไว้ในแถวอื่น
    // ถ้าแถวอื่นกินโควตาไปหมดแล้ว (เกิดได้จากการเลื่อนยอดที่ขาด) ยังต้องแก้วัน/ลดจำนวนของแถวนี้ได้เสมอ
    // จึงใช้จำนวนเดิมเป็นพื้นขั้นต่ำของเพดาน
    $otherStmt = $pdo->prepare("SELECT COALESCE(SUM(expected_qty), 0) FROM stock_arrival_plan_expectations WHERE item_id = ? AND id != ?");
    $otherStmt->execute([(int)$expectation['item_id'], $expectationId]);
    $otherScheduled = (int)$otherStmt->fetchColumn();

    $currentQty = (int)$expectation['expected_qty'];
    $maxQty = max((int)$expectation['planned_qty'] - $otherScheduled, $currentQty);
    if ($expectedQty > $maxQty) {
        throw new Exception("จำนวนเกินยอดที่แพลนไว้ของสินค้านี้ (ใส่ได้ไม่เกิน $maxQty)");
    }

    $pdo->prepare("UPDATE stock_arrival_plan_expectations
                    SET expected_qty = ?, expected_date = ?, so_number = ?
                    WHERE id = ?")
        ->execute([$expectedQty, $expectedDate, ($soNumber === '' ? null : $soNumber), $expectationId]);

    $pdo->commit();
    echo json_encode(['success' => true]);

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
