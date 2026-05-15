<?php
/**
 * Monitor — Lead Performance (Conversion Funnel)
 *
 * Funnel:
 *   Distributed → Called (talked) → Closed (order)
 *
 * Sources:
 *   - Distributed: basket_transition_log where transition_type IN
 *     ('distribute','redistribute','manual') and assigned_to_new in team
 *     and created_at within period
 *   - Called: call_history joined to caller name (manual log) — count distinct
 *     customer_id where status='รับสาย' or duration>=40
 *   - Closed: orders/order_items where creator_id in team within period
 *
 * Auth: Supervisor sees team, Admin/CEO sees company, Telesale sees self only.
 */

require_once __DIR__ . '/../config.php';

cors();

try {
    $pdo = db_connect();
    $user = get_authenticated_user($pdo);
    if (!$user) {
        json_response(['success' => false, 'message' => 'Unauthorized'], 401);
        exit;
    }

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

    // Params
    $year  = isset($_GET['year'])  ? (int) $_GET['year']  : (int) date('Y');
    $month = isset($_GET['month']) ? (int) $_GET['month'] : (int) date('m');
    if ($month < 1 || $month > 12) {
        json_response(['success' => false, 'message' => 'Invalid month'], 400);
        exit;
    }
    $start = sprintf('%04d-%02d-01', $year, $month);
    $endTs = strtotime("$start +1 month");
    $end   = date('Y-m-d', $endTs);

    // User filter
    $userFilter = "";
    $userParams = [];
    if ($isSupervisor && !$isAdmin && !$isCEO) {
        $userFilter = " AND (u.supervisor_id = ? OR u.id = ?)";
        $userParams = [$currentUserId, $currentUserId];
    } elseif ($isTelesale && !$isAdmin && !$isCEO && !$isSupervisor) {
        $userFilter = " AND u.id = ?";
        $userParams = [$currentUserId];
    }

    // Member list
    $sql = "
        SELECT u.id, u.first_name, u.last_name, u.phone, u.role, u.supervisor_id
        FROM users u
        WHERE u.company_id = ? AND u.status='active' AND u.role_id IN (6,7)
        $userFilter
        ORDER BY u.first_name
    ";
    $stmt = $pdo->prepare($sql);
    $stmt->execute(array_merge([$companyId], $userParams));
    $members = $stmt->fetchAll();

    $userIds = array_map(function ($m) { return (int) $m['id']; }, $members);
    if (empty($userIds)) {
        json_response(['success' => true, 'data' => empty_payload($year, $month)]);
        exit;
    }
    $idsIn = implode(',', $userIds);

    // 1) Distributed per user (May 2026 example: distribute|redistribute|manual)
    $sqlDist = "
        SELECT assigned_to_new AS uid,
               COUNT(DISTINCT customer_id) AS cnt
        FROM basket_transition_log
        WHERE transition_type IN ('distribute','redistribute','manual')
          AND assigned_to_new IN ($idsIn)
          AND created_at >= ? AND created_at < ?
        GROUP BY assigned_to_new
    ";
    $stmt = $pdo->prepare($sqlDist);
    $stmt->execute([$start, $end]);
    $dist = [];
    foreach ($stmt->fetchAll() as $r) $dist[(int) $r['uid']] = (int) $r['cnt'];

    // 2) Called per user — match by caller string = first_name + last_name
    $sqlCalled = "
        SELECT u.id AS uid, COUNT(DISTINCT ch.customer_id) AS cnt
        FROM users u
        LEFT JOIN call_history ch ON ch.caller = CONCAT(u.first_name, ' ', IFNULL(u.last_name, ''))
                                 AND ch.date >= ? AND ch.date < ?
                                 AND (ch.status = 'รับสาย' OR ch.duration >= 40)
        WHERE u.id IN ($idsIn)
        GROUP BY u.id
    ";
    $stmt = $pdo->prepare($sqlCalled);
    $stmt->execute([$start, $end]);
    $called = [];
    foreach ($stmt->fetchAll() as $r) $called[(int) $r['uid']] = (int) $r['cnt'];

    // 3) Closed per user — distinct customers with valid order
    $sqlClosed = "
        SELECT oi.creator_id AS uid,
               COUNT(DISTINCT o.customer_id) AS cnt,
               COALESCE(SUM(COALESCE(oi.net_total, oi.quantity * oi.price_per_unit)), 0) AS sales
        FROM orders o
        JOIN order_items oi ON oi.parent_order_id = o.id
        WHERE oi.creator_id IN ($idsIn)
          AND o.order_date >= ? AND o.order_date < ?
          AND o.order_status NOT IN ('Cancelled','BadDebt')
          AND (oi.is_freebie = 0 OR oi.is_freebie IS NULL)
          AND oi.parent_item_id IS NULL
        GROUP BY oi.creator_id
    ";
    $stmt = $pdo->prepare($sqlClosed);
    $stmt->execute([$start, $end]);
    $closed = [];
    $sales = [];
    foreach ($stmt->fetchAll() as $r) {
        $uid = (int) $r['uid'];
        $closed[$uid] = (int) $r['cnt'];
        $sales[$uid]  = (float) $r['sales'];
    }

    // Build response
    $totals = ['distributed' => 0, 'called' => 0, 'closed' => 0, 'sales' => 0.0];
    $rows = [];
    foreach ($members as $m) {
        $uid = (int) $m['id'];
        $d = $dist[$uid] ?? 0;
        $c = $called[$uid] ?? 0;
        $cl = $closed[$uid] ?? 0;
        $sl = $sales[$uid] ?? 0.0;
        $totals['distributed'] += $d;
        $totals['called']      += $c;
        $totals['closed']      += $cl;
        $totals['sales']       += $sl;
        $rows[] = [
            'user_id'    => $uid,
            'first_name' => $m['first_name'],
            'last_name'  => $m['last_name'],
            'name'       => trim(($m['first_name'] ?? '') . ' ' . ($m['last_name'] ?? '')),
            'role'       => $m['role'],
            'distributed'=> $d,
            'called'     => $c,
            'closed'     => $cl,
            'sales'      => round($sl, 2),
            'call_rate'  => $d > 0 ? round($c / $d, 4) : 0,
            'close_rate' => $d > 0 ? round($cl / $d, 4) : 0,
            'call_close' => $c > 0 ? round($cl / $c, 4) : 0,
        ];
    }

    json_response([
        'success' => true,
        'data' => [
            'period' => ['year' => $year, 'month' => $month, 'start' => $start, 'end' => $end],
            'team_totals' => [
                'distributed' => $totals['distributed'],
                'called'      => $totals['called'],
                'closed'      => $totals['closed'],
                'sales'       => round($totals['sales'], 2),
                'call_rate'   => $totals['distributed'] > 0 ? round($totals['called'] / $totals['distributed'], 4) : 0,
                'close_rate'  => $totals['distributed'] > 0 ? round($totals['closed']  / $totals['distributed'], 4) : 0,
                'call_close'  => $totals['called'] > 0       ? round($totals['closed']  / $totals['called'], 4)      : 0,
            ],
            'members' => $rows,
            'viewer' => [
                'user_id' => $currentUserId,
                'role'    => $user['role'],
                'is_supervisor' => $isSupervisor,
                'is_admin'      => $isAdmin || $isCEO,
            ],
        ],
    ]);

} catch (Throwable $e) {
    error_log("Monitor/lead_performance.php: " . $e->getMessage());
    json_response(['success' => false, 'message' => 'Server error', 'detail' => $e->getMessage()], 500);
}

function empty_payload($year, $month)
{
    $start = sprintf('%04d-%02d-01', $year, $month);
    $end = date('Y-m-d', strtotime("$start +1 month"));
    return [
        'period' => ['year' => $year, 'month' => $month, 'start' => $start, 'end' => $end],
        'team_totals' => [
            'distributed' => 0, 'called' => 0, 'closed' => 0, 'sales' => 0,
            'call_rate' => 0, 'close_rate' => 0, 'call_close' => 0,
        ],
        'members' => [],
    ];
}
