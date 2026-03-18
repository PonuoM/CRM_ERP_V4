<?php
// Stock View API — Current stock grouped by warehouse > product > variant > lot
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

require_once __DIR__ . '/../config.php';
$pdo = db_connect();

try {
    $where = ["1=1"];
    $params = [];

    if (!empty($_GET['company_id'])) { $where[] = "w.company_id = ?"; $params[] = $_GET['company_id']; }
    if (!empty($_GET['warehouse_id'])) { $where[] = "s.warehouse_id = ?"; $params[] = $_GET['warehouse_id']; }
    if (!empty($_GET['product_id'])) { $where[] = "s.product_id = ?"; $params[] = $_GET['product_id']; }
    if (!empty($_GET['search'])) {
        $where[] = "(p.name LIKE ? OR p.sku LIKE ? OR s.lot_number LIKE ?)";
        $params[] = "%{$_GET['search']}%";
        $params[] = "%{$_GET['search']}%";
        $params[] = "%{$_GET['search']}%";
    }
    if (isset($_GET['hide_zero']) && $_GET['hide_zero'] == '1') {
        $where[] = "s.quantity <> 0";
    }

    $whereSql = implode(" AND ", $where);

    $sql = "SELECT s.id, s.warehouse_id, s.product_id, s.variant, s.lot_number,
                   s.quantity, s.mfg_date, s.exp_date, s.unit_cost,
                   s.created_at, s.updated_at,
                   w.name as warehouse_name,
                   p.name as product_name, p.sku as product_sku, p.unit as product_unit
            FROM inv2_stock s
            INNER JOIN warehouses w ON s.warehouse_id = w.id
            INNER JOIN products p ON s.product_id = p.id
            WHERE $whereSql
            ORDER BY w.name, p.name, s.lot_number, COALESCE(s.exp_date, '9999-12-31') ASC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Summary stats
    $totalQty = 0;
    $totalValue = 0;
    foreach ($rows as $row) {
        $totalQty += (float)$row['quantity'];
        if ($row['unit_cost']) {
            $totalValue += (float)$row['quantity'] * (float)$row['unit_cost'];
        }
    }

    echo json_encode([
        'success' => true,
        'data' => $rows,
        'summary' => [
            'total_items' => count($rows),
            'total_quantity' => $totalQty,
            'total_value' => round($totalValue, 2)
        ]
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
