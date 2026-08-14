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
    $force = !empty($input['force']); // ข้ามด่าน "ห้ามแตะรายการที่รับเข้าจริงแล้ว" -- Super Admin เท่านั้น

    // แก้ไขแพลนได้เฉพาะบัญชีที่ได้รับสิทธิ์ (เกณฑ์เดียวกับเพิ่ม/ลบแพลน)
    stock_plan_require_manage($pdo, $userId);
    if ($force && !stock_plan_is_super_admin($pdo, $userId)) {
        $force = false;
    }

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

    // Existing items keyed by id, split into what's still editable vs. what's already history.
    //   locked_qty / locked_count = expectations that were confirmed or closed short — real
    //     goods movements. Changing the product or dropping the item would rewrite what the
    //     warehouse actually received, so that needs a Super Admin force.
    //   Expectations still sitting at 'expected' are just a schedule; correcting them is
    //     ordinary editing, so the product can change and the item can be dropped (its
    //     scheduled rows cascade away with it).
    $existingStmt = $pdo->prepare("
        SELECT i.id, i.product_id,
               COALESCE(SUM(CASE WHEN e.status <> 'expected' THEN e.expected_qty ELSE 0 END), 0) AS locked_qty,
               COUNT(CASE WHEN e.status <> 'expected' THEN 1 END) AS locked_count
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
            'locked_qty' => (int)$row['locked_qty'],
            'locked_count' => (int)$row['locked_count'],
        ];
    }

    $submittedIds = [];
    foreach ($items as $item) {
        if (!empty($item['id'])) {
            $submittedIds[] = (int)$item['id'];
        }
    }

    // Items dropped from the submitted list = the user wants to remove them.
    foreach ($existingItems as $existingId => $existing) {
        if (in_array($existingId, $submittedIds, true)) {
            continue;
        }
        if ($existing['locked_count'] > 0 && !$force) {
            throw new Exception("ลบรายการสินค้าที่ยืนยันรับเข้าจริงไปแล้วไม่ได้ (item id $existingId)");
        }
        // Cascades to its expectations via FK
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
            if ($plannedQty < $existing['locked_qty'] && !$force) {
                throw new Exception("จำนวนใหม่ต่ำกว่ายอดที่ยืนยันรับเข้าจริงไปแล้ว (item id $itemId ต้องไม่ต่ำกว่า {$existing['locked_qty']})");
            }
            if ($productId !== $existing['product_id'] && $existing['locked_count'] > 0 && !$force) {
                throw new Exception("เปลี่ยนสินค้าของรายการที่ยืนยันรับเข้าจริงไปแล้วไม่ได้ (item id $itemId)");
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
