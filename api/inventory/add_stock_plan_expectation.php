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
$pdo = db_connect();

try {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input || empty($input['item_id']) || empty($input['expected_date']) || (int)($input['expected_qty'] ?? 0) <= 0) {
        throw new Exception('Invalid input');
    }

    $itemId = (int)$input['item_id'];
    $expectedQty = (int)$input['expected_qty'];
    $expectedDate = $input['expected_date'];
    $soNumber = $input['so_number'] ?? null;
    $userId = $input['user_id'] ?? null;

    $pdo->beginTransaction();

    $stmt = $pdo->prepare("SELECT planned_qty FROM stock_arrival_plan_items WHERE id = ? FOR UPDATE");
    $stmt->execute([$itemId]);
    $item = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$item) {
        throw new Exception('Item not found');
    }

    $scheduledStmt = $pdo->prepare("SELECT COALESCE(SUM(expected_qty), 0) FROM stock_arrival_plan_expectations WHERE item_id = ?");
    $scheduledStmt->execute([$itemId]);
    $alreadyScheduled = (int)$scheduledStmt->fetchColumn();

    $remaining = (int)$item['planned_qty'] - $alreadyScheduled;
    if ($expectedQty > $remaining) {
        throw new Exception("จำนวนที่กำหนดวันที่คาดว่าจะเข้าเกินจำนวนที่เหลืออยู่ (เหลือ $remaining)");
    }

    $insertStmt = $pdo->prepare("INSERT INTO stock_arrival_plan_expectations (item_id, expected_qty, expected_date, so_number, created_by) VALUES (?, ?, ?, ?, ?)");
    $insertStmt->execute([$itemId, $expectedQty, $expectedDate, $soNumber, $userId]);
    $expectationId = $pdo->lastInsertId();

    $pdo->commit();
    echo json_encode(['success' => true, 'id' => $expectationId]);

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
