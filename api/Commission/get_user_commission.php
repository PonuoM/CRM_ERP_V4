<?php
/**
 * User Commission Summary — ดึงค่าคอมรวมแยกตาม user + ช่วงเวลา
 * GET ?company_id=1&group_by=month&start_date=2026-01-01&end_date=2026-03-31
 */
require_once __DIR__ . "/../config.php";

header('Content-Type: application/json; charset=utf-8');

try {
    $pdo = db_connect();

    $company_id = (int)($_GET['company_id'] ?? 0);
    $group_by = $_GET['group_by'] ?? 'month';  // month | week | day
    $start_date = $_GET['start_date'] ?? date('Y-m-01', strtotime('-2 months'));
    $end_date = $_GET['end_date'] ?? date('Y-m-d');

    if (!$company_id) {
        echo json_encode(['ok' => false, 'error' => 'Missing company_id']);
        exit;
    }

    // Ensure tables exist
    ob_start();
    require_once __DIR__ . '/migrate_commission_stamp.php';
    ob_end_clean();

    // Build period expression based on group_by
    switch ($group_by) {
        case 'week':
            $periodExpr = "DATE_FORMAT(o.order_date, '%x-W%v')"; // ISO year-week
            break;
        case 'day':
            $periodExpr = "DATE(o.order_date)";
            break;
        default: // month
            $periodExpr = "DATE_FORMAT(o.order_date, '%Y-%m')";
            break;
    }

    // Query: commission per user per period
    $sql = "
        WITH BaseData AS (
            SELECT
            cso.user_id,
            u.first_name,
            u.last_name,
            u.username,
            COALESCE(DATE(CONCAT(csb.for_year, '-', LPAD(csb.for_month, 2, '0'), '-01')), csb.created_at) AS effective_date,
            COUNT(DISTINCT CASE WHEN cso.order_id != 'sum_commission' THEN cso.order_id END) AS order_count,
            COALESCE(SUM(cso.commission_amount), 0) AS total_commission
        FROM commission_stamp_orders cso
        JOIN commission_stamp_batches csb ON csb.id = cso.batch_id AND csb.company_id = ?
        LEFT JOIN orders o ON o.id = cso.order_id
        LEFT JOIN users u ON u.id = cso.user_id
    )
    SELECT
        user_id,
        first_name,
        last_name,
        username,
        CASE 
            WHEN ? = 'week' THEN DATE_FORMAT(effective_date, '%x-W%v')
            WHEN ? = 'day' THEN DATE(effective_date)
            ELSE DATE_FORMAT(effective_date, '%Y-%m')
        END AS period,
        SUM(order_count) AS order_count,
        SUM(total_commission) AS total_commission
    FROM BaseData
    WHERE effective_date >= ? AND effective_date < DATE_ADD(?, INTERVAL 1 DAY)
    GROUP BY user_id, first_name, last_name, username, period
    ORDER BY period DESC, total_commission DESC
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute([$company_id, $group_by, $group_by, $start_date, $end_date]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Also get totals per user (across all periods in range)
    $sqlTotals = "
        WITH BaseData AS (
            SELECT
                cso.user_id,
                u.first_name,
                u.last_name,
                u.username,
                COALESCE(DATE(CONCAT(csb.for_year, '-', LPAD(csb.for_month, 2, '0'), '-01')), csb.created_at) AS effective_date,
                COUNT(DISTINCT CASE WHEN cso.order_id != 'sum_commission' THEN cso.order_id END) AS order_count,
                COALESCE(SUM(cso.commission_amount), 0) AS total_commission
            FROM commission_stamp_orders cso
            JOIN commission_stamp_batches csb ON csb.id = cso.batch_id AND csb.company_id = ?
            LEFT JOIN orders o ON o.id = cso.order_id
            LEFT JOIN users u ON u.id = cso.user_id
            GROUP BY cso.user_id, u.first_name, u.last_name, u.username, effective_date
        )
        SELECT
            user_id,
            first_name,
            last_name,
            username,
            SUM(order_count) AS order_count,
            SUM(total_commission) AS total_commission
        FROM BaseData
        WHERE effective_date >= ? AND effective_date < DATE_ADD(?, INTERVAL 1 DAY)
        GROUP BY user_id, first_name, last_name, username
        ORDER BY total_commission DESC
    ";

    $stmtTotals = $pdo->prepare($sqlTotals);
    $stmtTotals->execute([$company_id, $start_date, $end_date]);
    $userTotals = $stmtTotals->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'ok' => true,
        'data' => [
            'rows' => $rows,
            'user_totals' => $userTotals,
        ]
    ]);

} catch (Exception $e) {
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}
