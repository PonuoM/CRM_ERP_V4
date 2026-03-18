<?php
/**
 * Commission Summary — Count orders by 3 statuses, grouped by period
 * GET ?company_id=&group_by=month|week|day&start_date=&end_date=
 * 
 * Statuses:
 *   incomplete: payment_status != 'Approved' AND not stamped
 *   pending:    payment_status = 'Approved' AND not stamped
 *   calculated: stamped (exists in commission_stamp_orders)
 */
require_once __DIR__ . "/../config.php";

header('Content-Type: application/json; charset=utf-8');

try {
    $pdo = db_connect();

    $company_id = (int)($_GET['company_id'] ?? 0);
    $group_by = $_GET['group_by'] ?? 'month';
    $start_date = $_GET['start_date'] ?? null;
    $end_date = $_GET['end_date'] ?? null;

    // Determine GROUP BY expression
    switch ($group_by) {
        case 'day':
            $groupExpr = "DATE(o.order_date)";
            $groupLabel = "DATE_FORMAT(o.order_date, '%Y-%m-%d')";
            break;
        case 'week':
            $groupExpr = "YEARWEEK(o.order_date, 1)";
            $groupLabel = "CONCAT(YEAR(o.order_date), '-W', LPAD(WEEK(o.order_date, 1), 2, '0'))";
            break;
        case 'month':
        default:
            $groupExpr = "DATE_FORMAT(o.order_date, '%Y-%m')";
            $groupLabel = "DATE_FORMAT(o.order_date, '%Y-%m')";
            break;
    }

    $where = "WHERE 1=1";
    $params = [];

    if ($company_id > 0) {
        $where .= " AND o.company_id = ?";
        $params[] = $company_id;
    }

    // Filter out sub-orders (e.g. 260101-00001abc-2)
    $where .= " AND o.id NOT REGEXP '-[0-9]+$'";

    if ($start_date) {
        $where .= " AND o.order_date >= ?";
        $params[] = $start_date;
    }
    if ($end_date) {
        $where .= " AND o.order_date <= ?";
        $params[] = $end_date . ' 23:59:59';
    }

    $sql = "
        SELECT
            $groupLabel as period,
            SUM(CASE WHEN cso.id IS NOT NULL THEN 1 ELSE 0 END) as calculated,
            SUM(CASE WHEN cso.id IS NULL AND o.payment_status = 'Approved' THEN 1 ELSE 0 END) as pending,
            SUM(CASE WHEN cso.id IS NULL AND (o.payment_status != 'Approved' OR o.payment_status IS NULL) THEN 1 ELSE 0 END) as incomplete,
            COUNT(*) as total,
            SUM(CASE WHEN cso.id IS NOT NULL THEN COALESCE(cso.total_commission, 0) ELSE 0 END) as total_commission
        FROM orders o
        LEFT JOIN (
            SELECT order_id, SUM(commission_amount) as total_commission, MIN(id) as id
            FROM commission_stamp_orders
            GROUP BY order_id
        ) cso ON cso.order_id = o.id
        $where
        GROUP BY $groupExpr
        ORDER BY period DESC
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Totals
    $totals = [
        'calculated' => 0,
        'pending' => 0,
        'incomplete' => 0,
        'total' => 0,
        'total_commission' => 0
    ];
    foreach ($rows as $row) {
        $totals['calculated'] += (int)$row['calculated'];
        $totals['pending'] += (int)$row['pending'];
        $totals['incomplete'] += (int)$row['incomplete'];
        $totals['total'] += (int)$row['total'];
        $totals['total_commission'] += (float)$row['total_commission'];
    }

    echo json_encode([
        'ok' => true,
        'data' => [
            'rows' => $rows,
            'totals' => $totals
        ]
    ]);

} catch (Exception $e) {
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}
