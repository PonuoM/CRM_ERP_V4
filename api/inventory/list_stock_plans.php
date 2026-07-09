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
    $month = isset($_GET['month']) ? (int)$_GET['month'] : null;
    $year = isset($_GET['year']) ? (int)$_GET['year'] : null;
    $companyId = isset($_GET['companyId']) ? (int)$_GET['companyId'] : null;
    $status = isset($_GET['status']) ? $_GET['status'] : '';
    $productId = isset($_GET['productId']) ? (int)$_GET['productId'] : null;
    $search = isset($_GET['search']) ? $_GET['search'] : '';

    $data = [];

    // ---- Pending: items still awaiting an "expected arrival" date/qty to be scheduled ----
    if (empty($status) || $status === 'pending') {
        $whereClauses = ["1=1"];
        $params = [];
        if ($month && $year) {
            $whereClauses[] = "MONTH(p.planned_date) = ? AND YEAR(p.planned_date) = ?";
            $params[] = $month;
            $params[] = $year;
        }
        if ($companyId) {
            $whereClauses[] = "p.company_id = ?";
            $params[] = $companyId;
        }
        if ($productId) {
            $whereClauses[] = "i.product_id = ?";
            $params[] = $productId;
        }
        if (!empty($search)) {
            $whereClauses[] = "p.notes LIKE ?";
            $params[] = "%$search%";
        }
        $whereSql = implode(" AND ", $whereClauses);

        $sql = "SELECT i.id AS item_id, i.product_id, i.planned_qty,
                       p.id AS plan_id, p.planned_date, p.notes AS plan_notes, p.company_id,
                       pr.sku, pr.name AS product_name,
                       (i.planned_qty - COALESCE(SUM(e.expected_qty), 0)) AS remaining_qty
                FROM stock_arrival_plan_items i
                JOIN stock_arrival_plans p ON i.plan_id = p.id
                JOIN products pr ON i.product_id = pr.id
                LEFT JOIN stock_arrival_plan_expectations e ON e.item_id = i.id
                WHERE $whereSql
                GROUP BY i.id
                HAVING remaining_qty > 0
                ORDER BY p.planned_date ASC, i.id ASC";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $data[] = [
                'kind' => 'pending',
                'display_date' => $row['planned_date'],
                'remaining_qty' => (int)$row['remaining_qty'],
                'item' => [
                    'id' => (int)$row['item_id'],
                    'product_id' => (int)$row['product_id'],
                    'planned_qty' => (int)$row['planned_qty'],
                    'sku' => $row['sku'],
                    'product_name' => $row['product_name'],
                ],
                'plan' => [
                    'id' => (int)$row['plan_id'],
                    'planned_date' => $row['planned_date'],
                    'notes' => $row['plan_notes'],
                    'company_id' => $row['company_id'],
                ],
            ];
        }
    }

    // ---- Expectations: scheduled expected-arrival entries (orange/green/red) ----
    if (empty($status) || in_array($status, ['expected', 'confirmed', 'closed_short'], true)) {
        $whereClauses = ["1=1"];
        $params = [];
        if ($month && $year) {
            $whereClauses[] = "MONTH(COALESCE(e.actual_date, e.expected_date)) = ? AND YEAR(COALESCE(e.actual_date, e.expected_date)) = ?";
            $params[] = $month;
            $params[] = $year;
        }
        if ($companyId) {
            $whereClauses[] = "p.company_id = ?";
            $params[] = $companyId;
        }
        if (!empty($status) && in_array($status, ['expected', 'confirmed', 'closed_short'], true)) {
            $whereClauses[] = "e.status = ?";
            $params[] = $status;
        }
        if ($productId) {
            $whereClauses[] = "i.product_id = ?";
            $params[] = $productId;
        }
        if (!empty($search)) {
            $whereClauses[] = "(p.notes LIKE ? OR e.note LIKE ? OR e.so_number LIKE ?)";
            $params[] = "%$search%";
            $params[] = "%$search%";
            $params[] = "%$search%";
        }
        $whereSql = implode(" AND ", $whereClauses);

        $sql = "SELECT
                    e.id, e.expected_qty, e.expected_date, e.so_number, e.status,
                    e.actual_qty, e.actual_date, e.note, e.next_expectation_id,
                    e.confirmed_by, e.confirmed_at,
                    i.id AS item_id, i.product_id, i.planned_qty AS item_planned_qty,
                    p.id AS plan_id, p.planned_date, p.notes AS plan_notes, p.company_id,
                    pr.sku, pr.name AS product_name
                FROM stock_arrival_plan_expectations e
                JOIN stock_arrival_plan_items i ON e.item_id = i.id
                JOIN stock_arrival_plans p ON i.plan_id = p.id
                JOIN products pr ON i.product_id = pr.id
                WHERE $whereSql
                ORDER BY COALESCE(e.actual_date, e.expected_date) ASC, e.id ASC";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $data[] = [
                'kind' => 'expectation',
                'id' => (int)$row['id'],
                'display_date' => $row['actual_date'] ?? $row['expected_date'],
                'expected_qty' => (int)$row['expected_qty'],
                'expected_date' => $row['expected_date'],
                'so_number' => $row['so_number'],
                'status' => $row['status'],
                'actual_qty' => $row['actual_qty'] !== null ? (int)$row['actual_qty'] : null,
                'actual_date' => $row['actual_date'],
                'note' => $row['note'],
                'next_expectation_id' => $row['next_expectation_id'] !== null ? (int)$row['next_expectation_id'] : null,
                'item' => [
                    'id' => (int)$row['item_id'],
                    'product_id' => (int)$row['product_id'],
                    'planned_qty' => (int)$row['item_planned_qty'],
                    'sku' => $row['sku'],
                    'product_name' => $row['product_name'],
                ],
                'plan' => [
                    'id' => (int)$row['plan_id'],
                    'planned_date' => $row['planned_date'],
                    'notes' => $row['plan_notes'],
                    'company_id' => $row['company_id'],
                ],
            ];
        }
    }

    echo json_encode(['success' => true, 'data' => $data]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
