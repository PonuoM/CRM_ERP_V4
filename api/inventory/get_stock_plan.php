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

    // Per item, the edit form needs to tell two very different things apart:
    //   open_scheduled_qty = expectations still at 'expected' — only a schedule, so editing
    //     the product or dropping the row is allowed (it just warns first).
    //   locked_qty / locked_count = confirmed or closed-short expectations — goods that really
    //     moved. Those are the hard floor; only a Super Admin force can go past them.
    // Keep in sync with the same split in update_stock_plan.php.
    $itemStmt = $pdo->prepare("
        SELECT i.id, i.product_id, i.planned_qty, pr.sku, pr.name AS product_name,
               COALESCE(SUM(CASE WHEN e.status = 'expected' THEN e.expected_qty ELSE 0 END), 0) AS open_scheduled_qty,
               COALESCE(SUM(CASE WHEN e.status <> 'expected' THEN e.expected_qty ELSE 0 END), 0) AS locked_qty,
               COUNT(CASE WHEN e.status <> 'expected' THEN 1 END) AS locked_count,
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
            'open_scheduled_qty' => (int)$row['open_scheduled_qty'],
            'locked_qty' => (int)$row['locked_qty'],
            'locked_count' => (int)$row['locked_count'],
            'has_expectations' => (int)$row['expectation_count'] > 0,
        ];
    }

    echo json_encode(['success' => true, 'plan' => $plan, 'items' => $items]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
