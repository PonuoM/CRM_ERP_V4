<?php
/**
 * Monitor — Sales Monitoring (Team Performance)
 *
 * Inspired by Primawell's ทีมจัดการ page. Shows per-staff sales, calls and
 * customer-base health over a configurable period (today/week/month/all).
 *
 * Period anchors:
 *   today → CURDATE
 *   week  → Monday of this week
 *   month → 1st of this month
 *   all   → no lower bound
 *
 * Sections:
 *   - CRM Telesale (role_id 6 + 7)
 *   - Sale Admin (role_id 3 — Admin Page)
 *
 * Targets (env table per company):
 *   - MONITOR_DAILY_CALL_TARGET_X         → talked calls/day (default 40)
 *   - MONITOR_DAILY_CALL_MINUTE_TARGET_X  → call minutes/day (default 100)
 */

require_once __DIR__ . '/../config.php';

cors();

try {
    $pdo = db_connect();
    $user = get_authenticated_user($pdo);
    if (!$user) { json_response(['success' => false, 'message' => 'Unauthorized'], 401); exit; }

    $companyId = (int) $user['company_id'];
    $currentUserId = (int) $user['id'];
    $role = strtolower($user['role'] ?? '');

    $isAdmin      = strpos($role, 'admin') !== false && strpos($role, 'supervisor') === false && strpos($role, 'admin page') === false;
    $isSupervisor = strpos($role, 'supervisor') !== false;
    $isCEO        = strpos($role, 'ceo') !== false;
    $isTelesale   = strpos($role, 'telesale') !== false;
    if (!$isAdmin && !$isSupervisor && !$isCEO && !$isTelesale) {
        json_response(['success' => false, 'message' => 'Access denied'], 403);
        exit;
    }

    // Period param
    $period = $_GET['period'] ?? 'week';
    if (!in_array($period, ['today', 'week', 'month', 'all'], true)) $period = 'week';

    // Compute period range
    if ($period === 'today') {
        $start = date('Y-m-d') . ' 00:00:00';
    } elseif ($period === 'week') {
        $start = date('Y-m-d', strtotime('monday this week')) . ' 00:00:00';
    } elseif ($period === 'month') {
        $start = date('Y-m-01') . ' 00:00:00';
    } else {
        $start = '1970-01-01 00:00:00';
    }
    $end = date('Y-m-d', strtotime('+1 day')) . ' 00:00:00';
    $startDate = substr($start, 0, 10);
    $endDate   = substr($end, 0, 10);
    $today     = date('Y-m-d');

    // Targets
    $callTarget = (int) (fetch_env($pdo, "MONITOR_DAILY_CALL_TARGET_{$companyId}") ?: 40);
    $minuteTarget = (int) (fetch_env($pdo, "MONITOR_DAILY_CALL_MINUTE_TARGET_{$companyId}") ?: 100);

    // User filter
    $userFilter = '';
    $userParams = [];
    if ($isSupervisor && !$isAdmin && !$isCEO) {
        $userFilter = ' AND (u.supervisor_id = ? OR u.id = ?)';
        $userParams = [$currentUserId, $currentUserId];
    } elseif ($isTelesale && !$isAdmin && !$isCEO && !$isSupervisor) {
        $userFilter = ' AND u.id = ?';
        $userParams = [$currentUserId];
    }

    // Member list — include CRM Telesale (6,7) + Sale Admin (3)
    $sqlUsers = "
        SELECT u.id, u.username, u.first_name, u.last_name, u.phone, u.role, u.role_id, u.supervisor_id
        FROM users u
        WHERE u.company_id = ?
          AND u.status = 'active'
          AND u.role_id IN (3, 6, 7)
          $userFilter
        ORDER BY u.role_id, u.first_name
    ";
    $stmt = $pdo->prepare($sqlUsers);
    $stmt->execute(array_merge([$companyId], $userParams));
    $members = $stmt->fetchAll();

    $userIds = array_map(function ($u) { return (int) $u['id']; }, $members);
    if (empty($userIds)) {
        json_response(['success' => true, 'data' => empty_payload($period, $start, $end, $callTarget, $minuteTarget)]);
        exit;
    }
    $idsIn = implode(',', $userIds);

    // 1) Customer segments per user
    $sqlSeg = "
        SELECT c.assigned_to AS uid,
               COUNT(*) AS total,
               SUM(CASE WHEN c.current_basket_key IN ('38','46','47','48') THEN 1 ELSE 0 END) AS new_count,
               SUM(CASE WHEN c.current_basket_key IN ('39','40') THEN 1 ELSE 0 END) AS active_count,
               SUM(CASE WHEN c.current_basket_key IN ('49','50') THEN 1 ELSE 0 END) AS risk_count,
               SUM(CASE WHEN c.current_basket_key NOT IN ('38','39','40','46','47','48','49','50')
                          OR c.current_basket_key IS NULL THEN 1 ELSE 0 END) AS tank_count
        FROM customers c
        WHERE c.company_id = ? AND c.assigned_to IN ($idsIn)
        GROUP BY c.assigned_to
    ";
    $stmt = $pdo->prepare($sqlSeg);
    $stmt->execute([$companyId]);
    $segByUser = [];
    foreach ($stmt->fetchAll() as $r) $segByUser[(int) $r['uid']] = $r;

    // 2) Calls in period (call_import_logs)
    $sqlCalls = "
        SELECT cl.matched_user_id AS uid,
               COUNT(*) AS calls_total,
               SUM(CASE WHEN cl.status = 1 AND TIME_TO_SEC(cl.duration) >= 40 THEN 1 ELSE 0 END) AS talked_calls,
               ROUND(COALESCE(SUM(TIME_TO_SEC(cl.duration)), 0) / 60, 1) AS total_min,
               ROUND(COALESCE(AVG(NULLIF(TIME_TO_SEC(cl.duration), 0)), 0) / 60, 2) AS avg_min
        FROM call_import_logs cl
        WHERE cl.call_date >= ? AND cl.call_date < ?
          AND cl.matched_user_id IN ($idsIn)
        GROUP BY cl.matched_user_id
    ";
    $stmt = $pdo->prepare($sqlCalls);
    $stmt->execute([$startDate, $endDate]);
    $callsByUser = [];
    foreach ($stmt->fetchAll() as $r) $callsByUser[(int) $r['uid']] = $r;

    // 3) Orders in period (regular + total — for AOV)
    $sqlOrders = "
        SELECT oi.creator_id AS uid,
               COUNT(DISTINCT o.id) AS orders_period,
               COALESCE(SUM(COALESCE(oi.net_total, oi.quantity * oi.price_per_unit)), 0) AS sales_period,
               SUM(CASE WHEN DATE(o.order_date) = ? THEN 1 ELSE 0 END) AS orders_today_raw,
               SUM(CASE WHEN DATE(o.order_date) = ?
                          THEN COALESCE(oi.net_total, oi.quantity * oi.price_per_unit) ELSE 0 END) AS sales_today
        FROM orders o
        JOIN order_items oi ON oi.parent_order_id = o.id
        WHERE o.company_id = ?
          AND o.order_date >= ? AND o.order_date < ?
          AND o.order_status NOT IN ('Cancelled','BadDebt')
          AND (oi.is_freebie = 0 OR oi.is_freebie IS NULL)
          AND oi.parent_item_id IS NULL
          AND oi.creator_id IN ($idsIn)
        GROUP BY oi.creator_id
    ";
    $stmt = $pdo->prepare($sqlOrders);
    $stmt->execute([$today, $today, $companyId, $start, $end]);
    $ordersByUser = [];
    foreach ($stmt->fetchAll() as $r) $ordersByUser[(int) $r['uid']] = $r;

    // Distinct orders today (orders_today should count distinct orders)
    $sqlOrdersToday = "
        SELECT oi.creator_id AS uid, COUNT(DISTINCT o.id) AS orders_today
        FROM orders o
        JOIN order_items oi ON oi.parent_order_id = o.id
        WHERE o.company_id = ?
          AND DATE(o.order_date) = ?
          AND o.order_status NOT IN ('Cancelled','BadDebt')
          AND (oi.is_freebie = 0 OR oi.is_freebie IS NULL)
          AND oi.parent_item_id IS NULL
          AND oi.creator_id IN ($idsIn)
        GROUP BY oi.creator_id
    ";
    $stmt = $pdo->prepare($sqlOrdersToday);
    $stmt->execute([$companyId, $today]);
    $ordersTodayByUser = [];
    foreach ($stmt->fetchAll() as $r) $ordersTodayByUser[(int) $r['uid']] = (int) $r['orders_today'];

    // 4) Distributed in period
    $sqlDist = "
        SELECT assigned_to_new AS uid,
               COUNT(DISTINCT customer_id) AS distributed_period,
               SUM(CASE WHEN DATE(created_at) = ? THEN 1 ELSE 0 END) AS distributed_today,
               COUNT(*) AS rows_period
        FROM basket_transition_log
        WHERE transition_type IN ('distribute','redistribute','manual')
          AND created_at >= ? AND created_at < ?
          AND assigned_to_new IN ($idsIn)
        GROUP BY assigned_to_new
    ";
    $stmt = $pdo->prepare($sqlDist);
    $stmt->execute([$today, $start, $end]);
    $distByUser = [];
    foreach ($stmt->fetchAll() as $r) $distByUser[(int) $r['uid']] = $r;

    // 5) Total distributed (all-time) per user — for "รวม X" badge
    $sqlDistAll = "
        SELECT assigned_to_new AS uid, COUNT(DISTINCT customer_id) AS total_distributed
        FROM basket_transition_log
        WHERE transition_type IN ('distribute','redistribute','manual')
          AND assigned_to_new IN ($idsIn)
        GROUP BY assigned_to_new
    ";
    $stmt = $pdo->prepare($sqlDistAll);
    $stmt->execute();
    $totalDistByUser = [];
    foreach ($stmt->fetchAll() as $r) $totalDistByUser[(int) $r['uid']] = (int) $r['total_distributed'];

    // 6) Summary stats — scoped to viewer's visible team
    // "แจกวันนี้" = distinct customers distributed to anyone in the visible user set today
    $stmt = $pdo->prepare("
        SELECT COUNT(DISTINCT customer_id) AS c
        FROM basket_transition_log
        WHERE transition_type IN ('distribute','redistribute','manual')
          AND DATE(created_at) = ?
          AND assigned_to_new IN ($idsIn)
    ");
    $stmt->execute([$today]);
    $distributedToday = (int) $stmt->fetch()['c'];

    // "ลูกค้าทั้งหมด" = total customers assigned to the visible user set
    $stmt = $pdo->prepare("
        SELECT COUNT(*) c
        FROM customers
        WHERE company_id = ? AND assigned_to IN ($idsIn)
    ");
    $stmt->execute([$companyId]);
    $totalCustomers = (int) $stmt->fetch()['c'];

    // Build staff array
    $staff = [];
    foreach ($members as $m) {
        $uid = (int) $m['id'];
        $seg = $segByUser[$uid] ?? null;
        $call = $callsByUser[$uid] ?? null;
        $ord = $ordersByUser[$uid] ?? null;
        $dist = $distByUser[$uid] ?? null;
        $total = $seg ? (int) $seg['total'] : 0;
        $newCnt = $seg ? (int) $seg['new_count'] : 0;
        $activeCnt = $seg ? (int) $seg['active_count'] : 0;
        $riskCnt = $seg ? (int) $seg['risk_count'] : 0;
        $tankCnt = $seg ? (int) $seg['tank_count'] : 0;

        $callsTotal = $call ? (int) $call['calls_total'] : 0;
        $talkedCalls = $call ? (int) $call['talked_calls'] : 0;
        $totalMin = $call ? (float) $call['total_min'] : 0.0;
        $avgMin = $call ? (float) $call['avg_min'] : 0.0;

        $ordersPeriod = $ord ? (int) $ord['orders_period'] : 0;
        $salesPeriod = $ord ? (float) $ord['sales_period'] : 0.0;
        $ordersToday = $ordersTodayByUser[$uid] ?? 0;
        $salesToday = $ord ? (float) $ord['sales_today'] : 0.0;

        $aov = $ordersPeriod > 0 ? round($salesPeriod / $ordersPeriod) : 0;
        $closeRate = $total > 0 ? round($ordersPeriod / $total, 4) : 0;

        $department = $m['role_id'] == 3 ? 'Sale Admin' : 'CRM Telesale';

        $staff[] = [
            'user_id'          => $uid,
            'username'         => $m['username'],
            'first_name'       => $m['first_name'],
            'last_name'        => $m['last_name'],
            'name'             => trim(($m['first_name'] ?? '') . ' ' . ($m['last_name'] ?? '')),
            'phone'            => $m['phone'],
            'role'             => $m['role'],
            'role_id'          => (int) $m['role_id'],
            'department'       => $department,
            // Customer base
            'assigned_total'   => $total,
            'new_count'        => $newCnt,
            'active_count'     => $activeCnt,
            'risk_count'       => $riskCnt,
            'tank_count'       => $tankCnt,
            'qual_pct'         => $total > 0 ? round((($newCnt + $activeCnt) / $total) * 100) : 0,
            // Calls
            'calls_total'      => $callsTotal,
            'talked_calls'     => $talkedCalls,
            'total_min'        => round($totalMin, 1),
            'avg_min'          => round($avgMin, 2),
            'calls_per_cust'   => $total > 0 ? round($callsTotal / $total, 2) : 0,
            // Sales
            'orders_period'    => $ordersPeriod,
            'sales_period'     => round($salesPeriod, 2),
            'orders_today'     => $ordersToday,
            'sales_today'      => round($salesToday, 2),
            'aov'              => $aov,
            'close_rate'       => $closeRate,
            // Distribution
            'distributed_today'  => $dist ? (int) $dist['distributed_today'] : 0,
            'distributed_period' => $dist ? (int) $dist['distributed_period'] : 0,
            'total_distributed'  => $totalDistByUser[$uid] ?? 0,
        ];
    }

    json_response([
        'success' => true,
        'data' => [
            'period' => $period,
            'period_start' => $start,
            'period_end' => $end,
            'targets' => [
                'daily_calls' => $callTarget,
                'daily_minutes' => $minuteTarget,
            ],
            'summary' => [
                'staff_count' => count($staff),
                'total_customers' => $totalCustomers,
                'distributed_today' => $distributedToday,
            ],
            'staff' => $staff,
            'viewer' => [
                'user_id' => $currentUserId,
                'role' => $user['role'],
                'is_supervisor' => $isSupervisor,
                'is_admin' => $isAdmin || $isCEO,
            ],
        ],
    ]);

} catch (Throwable $e) {
    error_log("Monitor/sales_monitoring.php: " . $e->getMessage());
    json_response(['success' => false, 'message' => 'Server error', 'detail' => $e->getMessage()], 500);
}

function fetch_env(PDO $pdo, string $key)
{
    $stmt = $pdo->prepare("SELECT value FROM env WHERE `key` = ? LIMIT 1");
    $stmt->execute([$key]);
    $row = $stmt->fetch();
    return $row ? $row['value'] : null;
}

function empty_payload($period, $start, $end, $callTarget, $minuteTarget)
{
    return [
        'period' => $period,
        'period_start' => $start,
        'period_end' => $end,
        'targets' => ['daily_calls' => $callTarget, 'daily_minutes' => $minuteTarget],
        'summary' => ['staff_count' => 0, 'total_customers' => 0, 'distributed_today' => 0],
        'staff' => [],
    ];
}
