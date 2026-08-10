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
    if (!$input) {
        throw new Exception('Invalid input');
    }

    $planId = (int)($input['id'] ?? 0);
    $plannedDate = $input['planned_date'] ?? null;
    $notes = $input['notes'] ?? '';
    $items = $input['items'] ?? [];
    $userId = $input['user_id'] ?? null;

    // แก้ไขแพลนได้เฉพาะบัญชีที่ได้รับสิทธิ์ (เกณฑ์เดียวกับเพิ่ม/ลบแพลน)
    stock_plan_require_manage($pdo, $userId);

    if (!$planId) {
        throw new Exception('Missing plan id');
    }
    if (empty($plannedDate) || empty($items)) {
        throw new Exception('Missing required fields');
    }
    foreach ($items as $item) {
        if (empty($item['product_id']) || (int)($item['planned_qty'] ?? 0) <= 0) {
            throw new Exception('Invalid item data');
        }
    }

    $pdo->beginTransaction();

    $planStmt = $pdo->prepare("SELECT id FROM stock_arrival_plans WHERE id = ?");
    $planStmt->execute([$planId]);
    if (!$planStmt->fetch()) {
        throw new Exception('Plan not found');
    }

    // Existing items keyed by id, with how much is already scheduled against each
    // (an item that already has expectations can't have its product changed or its
    // quantity reduced below what's already been scheduled — that would either
    // silently invalidate real scheduling history or make remaining_qty negative).
    $existingStmt = $pdo->prepare("
        SELECT i.id, i.product_id, COALESCE(SUM(e.expected_qty), 0) AS scheduled_qty
        FROM stock_arrival_plan_items i
        LEFT JOIN stock_arrival_plan_expectations e ON e.item_id = i.id
        WHERE i.plan_id = ?
        GROUP BY i.id
    ");
    $existingStmt->execute([$planId]);
    $existingItems = [];
    foreach ($existingStmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $existingItems[(int)$row['id']] = [
            'product_id' => (int)$row['product_id'],
            'scheduled_qty' => (int)$row['scheduled_qty'],
        ];
    }

    $submittedIds = [];
    foreach ($items as $item) {
        if (!empty($item['id'])) {
            $submittedIds[] = (int)$item['id'];
        }
    }

    // Items dropped from the submitted list = the user wants to remove them.
    // Only allow that if nothing has been scheduled against them yet.
    foreach ($existingItems as $existingId => $existing) {
        if (in_array($existingId, $submittedIds, true)) {
            continue;
        }
        if ($existing['scheduled_qty'] > 0) {
            throw new Exception("ลบรายการสินค้าที่มีการกำหนดวันที่คาดว่าจะเข้าไปแล้วไม่ได้ (item id $existingId)");
        }
        $pdo->prepare("DELETE FROM stock_arrival_plan_items WHERE id = ?")->execute([$existingId]);
    }

    $insertStmt = $pdo->prepare("INSERT INTO stock_arrival_plan_items (plan_id, product_id, planned_qty) VALUES (?, ?, ?)");
    $updateStmt = $pdo->prepare("UPDATE stock_arrival_plan_items SET product_id = ?, planned_qty = ? WHERE id = ?");

    foreach ($items as $item) {
        $productId = (int)$item['product_id'];
        $plannedQty = (int)$item['planned_qty'];
        $itemId = !empty($item['id']) ? (int)$item['id'] : null;

        if ($itemId && isset($existingItems[$itemId])) {
            $existing = $existingItems[$itemId];
            if ($plannedQty < $existing['scheduled_qty']) {
                throw new Exception("จำนวนใหม่ต่ำกว่ายอดที่กำหนดวันที่คาดว่าจะเข้าไปแล้ว (item id $itemId ต้องไม่ต่ำกว่า {$existing['scheduled_qty']})");
            }
            if ($productId !== $existing['product_id'] && $existing['scheduled_qty'] > 0) {
                throw new Exception("เปลี่ยนสินค้าของรายการที่กำหนดวันที่คาดว่าจะเข้าไปแล้วไม่ได้ (item id $itemId)");
            }
            $updateStmt->execute([$productId, $plannedQty, $itemId]);
        } else {
            $insertStmt->execute([$planId, $productId, $plannedQty]);
        }
    }

    $pdo->prepare("UPDATE stock_arrival_plans SET planned_date = ?, notes = ? WHERE id = ?")
        ->execute([$plannedDate, $notes, $planId]);

    $pdo->commit();
    echo json_encode(['success' => true]);

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
