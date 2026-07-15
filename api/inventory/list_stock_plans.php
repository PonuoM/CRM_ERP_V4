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
require_once 'stock_plan_company_group.php';
$pdo = db_connect();

try {
    $month = isset($_GET['month']) ? (int)$_GET['month'] : null;
    $year = isset($_GET['year']) ? (int)$_GET['year'] : null;
    $companyId = isset($_GET['companyId']) ? (int)$_GET['companyId'] : null;
    $status = isset($_GET['status']) ? $_GET['status'] : '';
    $productId = isset($_GET['productId']) ? (int)$_GET['productId'] : null;
    $search = isset($_GET['search']) ? $_GET['search'] : '';

    // Companies that collaborate see each other's plans (e.g. พรีม่าแพสชั่น49 + พรีออนิค)
    $companyIds = $companyId ? stock_plan_company_ids($companyId) : [];
    $companyPlaceholders = $companyIds ? implode(',', array_fill(0, count($companyIds), '?')) : '';

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
        if ($companyIds) {
            $whereClauses[] = "p.company_id IN ($companyPlaceholders)";
            $params = array_merge($params, $companyIds);
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
                       p.id AS plan_id, p.planned_date, p.notes AS plan_notes, p.company_id, p.created_at AS plan_created_at,
                       COALESCE(NULLIF(TRIM(CONCAT(COALESCE(uc.first_name,''),' ',COALESCE(uc.last_name,''))), ''), uc.username) AS plan_created_by_name,
                       pr.sku, pr.name AS product_name,
                       (i.planned_qty - COALESCE(SUM(e.expected_qty), 0)) AS remaining_qty
                FROM stock_arrival_plan_items i
                JOIN stock_arrival_plans p ON i.plan_id = p.id
                JOIN stock_arrival_products pr ON i.product_id = pr.id
                LEFT JOIN users uc ON uc.id = p.created_by
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
                    'created_by_name' => $row['plan_created_by_name'],
                    'created_at' => $row['plan_created_at'],
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
        if ($companyIds) {
            $whereClauses[] = "p.company_id IN ($companyPlaceholders)";
            $params = array_merge($params, $companyIds);
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
                    e.confirmed_by, e.confirmed_at, e.created_at AS expectation_created_at,
                    COALESCE(NULLIF(TRIM(CONCAT(COALESCE(us.first_name,''),' ',COALESCE(us.last_name,''))), ''), us.username) AS scheduled_by_name,
                    COALESCE(NULLIF(TRIM(CONCAT(COALESCE(uf.first_name,''),' ',COALESCE(uf.last_name,''))), ''), uf.username) AS confirmed_by_name,
                    COALESCE(NULLIF(TRIM(CONCAT(COALESCE(uc.first_name,''),' ',COALESCE(uc.last_name,''))), ''), uc.username) AS plan_created_by_name,
                    p.created_at AS plan_created_at,
                    i.id AS item_id, i.product_id, i.planned_qty AS item_planned_qty,
                    p.id AS plan_id, p.planned_date, p.notes AS plan_notes, p.company_id,
                    pr.sku, pr.name AS product_name
                FROM stock_arrival_plan_expectations e
                JOIN stock_arrival_plan_items i ON e.item_id = i.id
                JOIN stock_arrival_plans p ON i.plan_id = p.id
                JOIN stock_arrival_products pr ON i.product_id = pr.id
                LEFT JOIN users us ON us.id = e.created_by
                LEFT JOIN users uf ON uf.id = e.confirmed_by
                LEFT JOIN users uc ON uc.id = p.created_by
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
                'scheduled_by_name' => $row['scheduled_by_name'],
                'scheduled_at' => $row['expectation_created_at'],
                'confirmed_by_name' => $row['confirmed_by_name'],
                'confirmed_at' => $row['confirmed_at'],
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
                    'created_by_name' => $row['plan_created_by_name'],
                    'created_at' => $row['plan_created_at'],
                ],
            ];
        }
    }

    echo json_encode(['success' => true, 'data' => $data]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
