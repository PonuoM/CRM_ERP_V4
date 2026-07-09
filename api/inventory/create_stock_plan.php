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
    if (!$input) {
        throw new Exception('Invalid input');
    }

    $companyId = $input['company_id'] ?? null;
    $plannedDate = $input['planned_date'] ?? null;
    $notes = $input['notes'] ?? '';
    $items = $input['items'] ?? [];
    $userId = $input['user_id'] ?? null;

    if (empty($plannedDate) || empty($items)) {
        throw new Exception('Missing required fields');
    }

    foreach ($items as $item) {
        if (empty($item['product_id']) || (int)($item['planned_qty'] ?? 0) <= 0) {
            throw new Exception('Invalid item data');
        }
    }

    $pdo->beginTransaction();

    $stmt = $pdo->prepare("INSERT INTO stock_arrival_plans (company_id, planned_date, notes, created_by) VALUES (?, ?, ?, ?)");
    $stmt->execute([$companyId, $plannedDate, $notes, $userId]);
    $planId = $pdo->lastInsertId();

    // Items only -- SO number and expected arrival dates/quantities are set later by the arrival-scheduler
    $itemStmt = $pdo->prepare("INSERT INTO stock_arrival_plan_items (plan_id, product_id, planned_qty) VALUES (?, ?, ?)");
    foreach ($items as $item) {
        $itemStmt->execute([$planId, $item['product_id'], (int)$item['planned_qty']]);
    }

    $pdo->commit();

    echo json_encode(['success' => true, 'id' => $planId]);

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
