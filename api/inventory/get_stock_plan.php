<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once '../config.php';
$pdo = db_connect();

try {
    $planId = isset($_GET['id']) ? (int)$_GET['id'] : 0;
    if (!$planId) {
        throw new Exception('Missing plan id');
    }

    $stmt = $pdo->prepare("SELECT id, company_id, planned_date, notes FROM stock_arrival_plans WHERE id = ?");
    $stmt->execute([$planId]);
    $plan = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$plan) {
        throw new Exception('Plan not found');
    }

    // Per item: how much is already scheduled (has expectations at all, and how much
    // of planned_qty those expectations account for) — the edit form needs both to
    // decide what's safe to shrink/remove.
    $itemStmt = $pdo->prepare("
        SELECT i.id, i.product_id, i.planned_qty, pr.sku, pr.name AS product_name,
               COALESCE(SUM(e.expected_qty), 0) AS scheduled_qty,
               COUNT(e.id) AS expectation_count
        FROM stock_arrival_plan_items i
        JOIN stock_arrival_products pr ON i.product_id = pr.id
        LEFT JOIN stock_arrival_plan_expectations e ON e.item_id = i.id
        WHERE i.plan_id = ?
        GROUP BY i.id
        ORDER BY i.id ASC
    ");
    $itemStmt->execute([$planId]);
    $items = [];
    foreach ($itemStmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $items[] = [
            'id' => (int)$row['id'],
            'product_id' => (int)$row['product_id'],
            'planned_qty' => (int)$row['planned_qty'],
            'sku' => $row['sku'],
            'product_name' => $row['product_name'],
            'scheduled_qty' => (int)$row['scheduled_qty'],
            'has_expectations' => (int)$row['expectation_count'] > 0,
        ];
    }

    echo json_encode(['success' => true, 'plan' => $plan, 'items' => $items]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
