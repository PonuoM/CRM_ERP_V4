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

    // Using o.order_date as primary grouping for summary, fallback to batch period for lumpsums.
    $calcBaseDateExpr = "COALESCE(o.order_date, DATE(CONCAT(csb.for_year, '-', LPAD(csb.for_month, 2, '0'), '-01')), csb.created_at)";

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

    $whereOrd = "o.id NOT REGEXP '-[0-9]+$' AND (o.order_status IS NULL OR o.order_status NOT IN ('Returned', 'Cancelled', 'BadDebt'))";
    $whereCalc = "1=1";
    $paramsOrd = [];
    $paramsCalc = [];

    if ($company_id > 0) {
        $whereOrd .= " AND o.company_id = ?";
        $paramsOrd[] = $company_id;
        $whereCalc .= " AND csb.company_id = ?";
        $paramsCalc[] = $company_id;
    }

    $calcGroupExpr = str_replace('o.order_date', $calcBaseDateExpr, $groupExpr);
    $calcGroupLabel = str_replace('o.order_date', $calcBaseDateExpr, $groupLabel);

    if ($start_date) {
        $whereOrd .= " AND o.order_date >= ?";
        $paramsOrd[] = $start_date;
        $whereCalc .= " AND $calcBaseDateExpr >= ?";
        $paramsCalc[] = $start_date;
    }
    if ($end_date) {
        $whereOrd .= " AND o.order_date <= ?";
        $paramsOrd[] = $end_date . ' 23:59:59';
        $whereCalc .= " AND $calcBaseDateExpr <= ?";
        $paramsCalc[] = $end_date . ' 23:59:59';
    }

    $sql = "
        WITH OrderData AS (
            SELECT
                $groupExpr as sort_period,
                $groupLabel as period,
                0 as calculated,
                SUM(CASE WHEN o.payment_status = 'Approved' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN (o.payment_status != 'Approved' OR o.payment_status IS NULL) THEN 1 ELSE 0 END) as incomplete,
                COUNT(*) as total,
                0 as total_commission
            FROM orders o
            LEFT JOIN commission_stamp_orders cso ON cso.order_id = o.id
            WHERE cso.id IS NULL AND $whereOrd
            GROUP BY sort_period, period
        ),
        CalculatedData AS (
            SELECT
                $calcGroupExpr as sort_period,
                $calcGroupLabel as period,
                SUM(CASE WHEN cso.order_id != 'sum_commission' THEN 1 ELSE 0 END) as calculated,
                0 as pending,
                0 as incomplete,
                SUM(CASE WHEN cso.order_id != 'sum_commission' THEN 1 ELSE 0 END) as total,
                SUM(cso.total_commission) as total_commission
            FROM (
                SELECT batch_id, order_id, SUM(commission_amount) as total_commission
                FROM commission_stamp_orders
                GROUP BY batch_id, order_id
            ) cso
            JOIN commission_stamp_batches csb ON csb.id = cso.batch_id
            LEFT JOIN orders o ON o.id = cso.order_id
            WHERE $whereCalc
            GROUP BY sort_period, period
        )
        SELECT
            period,
            SUM(calculated) as calculated,
            SUM(pending) as pending,
            SUM(incomplete) as incomplete,
            SUM(total) as total,
            SUM(total_commission) as total_commission
        FROM (
            SELECT * FROM OrderData
            UNION ALL
            SELECT * FROM CalculatedData
        ) CombinedData
        GROUP BY sort_period, period
        ORDER BY sort_period DESC
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute(array_merge($paramsOrd, $paramsCalc));
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
