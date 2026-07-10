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
    // Without asOfDate: the latest-ever configured value (what Settings edits going forward).
    // With asOfDate: whatever was effective at that point in time (what the Report uses per viewed month).
    $asOfDate = isset($_GET['asOfDate']) && $_GET['asOfDate'] !== '' ? $_GET['asOfDate'] : null;
    $companyId = isset($_GET['companyId']) && $_GET['companyId'] !== '' ? (int)$_GET['companyId'] : null;

    $params = [];
    $dateFilter = '';
    if ($asOfDate) {
        $dateFilter = 'WHERE effective_from <= ?';
        $params[] = $asOfDate;
    }

    // Scope to the current company's collaboration group (e.g. พรีม่าแพสชั่น49 + พรีออนิค see each other's plans)
    $itemsWhere = '1=1';
    $itemsParams = [];
    if ($companyId) {
        $companyIds = stock_plan_company_ids($companyId);
        $placeholders = implode(',', array_fill(0, count($companyIds), '?'));
        $itemsWhere = "p.company_id IN ($placeholders)";
        $itemsParams = $companyIds;
    }

    $sql = "SELECT pr.id AS product_id, pr.sku, pr.name AS product_name, latest.divisor, latest.effective_from
            FROM (SELECT DISTINCT i.product_id
                  FROM stock_arrival_plan_items i
                  JOIN stock_arrival_plans p ON p.id = i.plan_id
                  WHERE $itemsWhere) scoped
            JOIN products pr ON pr.id = scoped.product_id
            LEFT JOIN (
                SELECT product_id, divisor, effective_from FROM (
                    SELECT product_id, divisor, effective_from,
                           ROW_NUMBER() OVER (PARTITION BY product_id ORDER BY effective_from DESC) AS rn
                    FROM stock_arrival_ton_divisor_history
                    $dateFilter
                ) ranked WHERE rn = 1
            ) latest ON latest.product_id = pr.id
            ORDER BY pr.name ASC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute(array_merge($itemsParams, $params));
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $data = array_map(function ($row) {
        return [
            'product_id' => (int)$row['product_id'],
            'sku' => $row['sku'],
            'product_name' => $row['product_name'],
            'divisor' => $row['divisor'] !== null ? (float)$row['divisor'] : null,
            'effective_from' => $row['effective_from'],
        ];
    }, $rows);

    echo json_encode(['success' => true, 'data' => $data]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
