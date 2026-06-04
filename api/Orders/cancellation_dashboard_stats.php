<?php
require_once __DIR__ . '/../config.php';

try {
    $pdo = db_connect();
    $user = get_authenticated_user($pdo);
    if (!$user) {
        json_response(['error' => 'UNAUTHORIZED'], 401);
    }

    $companyId = $user['company_id'];
    $role = $user['role'];
    $userId = $user['id'];

    $dateStart = $_GET['dateStart'] ?? null;
    $dateEnd = $_GET['dateEnd'] ?? null;

    $conditions = ["o.order_status = 'Cancelled'", "o.company_id = ?"];
    $params = [$companyId];

    if ($dateStart) {
        $conditions[] = "o.order_date >= ?";
        $params[] = $dateStart . ' 00:00:00';
    }
    if ($dateEnd) {
        $conditions[] = "o.order_date <= ?";
        $params[] = $dateEnd . ' 23:59:59';
    }

    // Role visibility logic
    if ($role === 'Telesale') {
        $conditions[] = "o.creator_id = ?";
        $params[] = $userId;
    } else if ($role === 'Supervisor Telesale') {
        // Gets self and team members
        $conditions[] = "(o.creator_id = ? OR u.supervisor_id = ?)";
        $params[] = $userId;
        $params[] = $userId;
    }

    $whereClause = implode(' AND ', $conditions);

    // 1. Get stats per salesperson
    $sqlSalesperson = "
        SELECT 
            u.id as user_id, 
            CONCAT(u.first_name, ' ', u.last_name) as name,
            COUNT(o.id) as cancelled_count,
            SUM(o.total_amount) as cancelled_value,
            SUM(CASE WHEN oc.is_acknowledged = 0 AND o.order_status = 'Cancelled' THEN 1 ELSE 0 END) as unacknowledged_count
        FROM orders o
        JOIN users u ON o.creator_id = u.id
        LEFT JOIN order_cancellations oc ON o.id = oc.order_id
        WHERE $whereClause
        GROUP BY u.id
        ORDER BY cancelled_count DESC
    ";
    
    $stmt = $pdo->prepare($sqlSalesperson);
    $stmt->execute($params);
    $salespersonStats = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // 2. Get total orders and total sales (for calculating rates)
    // Needs same date range and visibility rules
    $conditionsTotal = ["o.company_id = ?"];
    $paramsTotal = [$companyId];
    if ($dateStart) {
        $conditionsTotal[] = "o.order_date >= ?";
        $paramsTotal[] = $dateStart . ' 00:00:00';
    }
    if ($dateEnd) {
        $conditionsTotal[] = "o.order_date <= ?";
        $paramsTotal[] = $dateEnd . ' 23:59:59';
    }
    if ($role === 'Telesale') {
        $conditionsTotal[] = "o.creator_id = ?";
        $paramsTotal[] = $userId;
    } else if ($role === 'Supervisor Telesale') {
        $conditionsTotal[] = "(o.creator_id = ? OR u.supervisor_id = ?)";
        $paramsTotal[] = $userId;
        $paramsTotal[] = $userId;
    }

    $whereClauseTotal = implode(' AND ', $conditionsTotal);

    $sqlTotals = "
        SELECT 
            u.id as user_id,
            COUNT(o.id) as total_orders
        FROM orders o
        JOIN users u ON o.creator_id = u.id
        WHERE $whereClauseTotal
        GROUP BY u.id
    ";
    $stmtTotal = $pdo->prepare($sqlTotals);
    $stmtTotal->execute($paramsTotal);
    $totals = $stmtTotal->fetchAll(PDO::FETCH_ASSOC);

    $totalsMap = [];
    foreach ($totals as $row) {
        $totalsMap[$row['user_id']] = $row['total_orders'];
    }

    // Merge total orders into salesperson stats
    foreach ($salespersonStats as &$stat) {
        $uid = $stat['user_id'];
        $stat['total_orders'] = $totalsMap[$uid] ?? 0;
        $stat['cancellation_rate'] = $stat['total_orders'] > 0 
            ? round(($stat['cancelled_count'] / $stat['total_orders']) * 100, 2) 
            : 0;
    }
    unset($stat);

    // 3. Get Reasons Breakdown (Combined with unclassified using LEFT JOIN)
    $sqlReasons = "
        SELECT 
            IFNULL(ct.label, 'ยังไม่ระบุเหตุผล') as label,
            COUNT(o.id) as count
        FROM orders o
        JOIN users u ON o.creator_id = u.id
        LEFT JOIN order_cancellations oc ON o.id = oc.order_id
        LEFT JOIN cancellation_types ct ON oc.cancellation_type_id = ct.id
        WHERE $whereClause
        GROUP BY ct.id
        ORDER BY count DESC
    ";
    
    $stmtReasons = $pdo->prepare($sqlReasons);
    $stmtReasons->execute($params);
    $reasons = $stmtReasons->fetchAll(PDO::FETCH_ASSOC);

    // 4. Get Timeline Stats (Daily)
    $sqlTimeline = "
        SELECT 
            DATE(o.order_date) as date_val,
            COUNT(o.id) as cancelled_count,
            SUM(o.total_amount) as cancelled_value
        FROM orders o
        JOIN users u ON o.creator_id = u.id
        WHERE $whereClause
        GROUP BY DATE(o.order_date)
        ORDER BY DATE(o.order_date) ASC
    ";
    
    $stmtTimeline = $pdo->prepare($sqlTimeline);
    $stmtTimeline->execute($params);
    $dailyStats = $stmtTimeline->fetchAll(PDO::FETCH_ASSOC);

    // Aggregate in PHP for Monthly and Yearly
    $monthlyMap = [];
    $yearlyMap = [];
    
    foreach ($dailyStats as &$row) {
        // cast value to float for safety
        $row['cancelled_value'] = (float)$row['cancelled_value'];
        
        $date = $row['date_val']; // YYYY-MM-DD
        $month = substr($date, 0, 7); // YYYY-MM
        $year = substr($date, 0, 4); // YYYY
        
        // Monthly
        if (!isset($monthlyMap[$month])) {
            $monthlyMap[$month] = ['date_val' => $month, 'cancelled_count' => 0, 'cancelled_value' => 0];
        }
        $monthlyMap[$month]['cancelled_count'] += $row['cancelled_count'];
        $monthlyMap[$month]['cancelled_value'] += $row['cancelled_value'];
        
        // Yearly
        if (!isset($yearlyMap[$year])) {
            $yearlyMap[$year] = ['date_val' => $year, 'cancelled_count' => 0, 'cancelled_value' => 0];
        }
        $yearlyMap[$year]['cancelled_count'] += $row['cancelled_count'];
        $yearlyMap[$year]['cancelled_value'] += $row['cancelled_value'];
    }
    unset($row);

    json_response([
        'salespersonStats' => $salespersonStats,
        'reasonsBreakdown' => $reasons,
        'timeline' => [
            'daily' => $dailyStats,
            'monthly' => array_values($monthlyMap),
            'yearly' => array_values($yearlyMap)
        ],
        'ok' => true
    ]);

} catch (Throwable $e) {
    json_response(['error' => 'INTERNAL_ERROR', 'message' => $e->getMessage()], 500);
}
