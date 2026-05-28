<?php
/**
 * Monitor — Daily Monitoring API
 *
 * Returns per-day call stats for a supervisor's team (or all team for admin/CEO),
 * including:
 *   - team totals (calls, talked, minutes, talk rate)
 *   - hourly breakdown (8:00..18:00) split into morning / afternoon
 *   - per-member detail rows
 *
 * Auth roles allowed: Admin/AdminControl/Admin System/CEO/Supervisor/Telesale
 *   - Supervisor: their team + themselves
 *   - Telesale: themselves only
 *   - Admin/CEO: everyone in their company
 *
 * Definition of "talked call" matches telesale_performance.php:
 *   status = 1 AND TIME_TO_SEC(duration) >= 30   // เกณฑ์ "ได้คุย" = 30 วินาที
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

    $companyId      = (int) $user['company_id'];
    $currentUserId  = (int) $user['id'];
    $role           = strtolower($user['role'] ?? '');

    $isAdmin       = strpos($role, 'admin') !== false && strpos($role, 'supervisor') === false && strpos($role, 'admin page') === false;
    $isSupervisor  = strpos($role, 'supervisor') !== false;
    $isCEO         = strpos($role, 'ceo') !== false;
    $isTelesale    = strpos($role, 'telesale') !== false || strpos($role, 'admin page') !== false;

    if (!$isAdmin && !$isSupervisor && !$isCEO && !$isTelesale) {
        json_response(['success' => false, 'message' => 'Access denied'], 403);
        exit;
    }

    // ===== Params =====
    $date = $_GET['date'] ?? date('Y-m-d');
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
        json_response(['success' => false, 'message' => 'Invalid date format. Use YYYY-MM-DD'], 400);
        exit;
    }

    // ===== Daily target (from env, per company; fallback 40) =====
    $stmt = $pdo->prepare("SELECT value FROM env WHERE `key` = ? LIMIT 1");
    $stmt->execute(["MONITOR_DAILY_CALL_TARGET_{$companyId}"]);
    $row = $stmt->fetch();
    $dailyTarget = $row ? max(1, (int) $row['value']) : 40;

    // ===== User filter (which users this caller can see) =====
    $userFilter = "";
    $userParams = [];
    if ($isSupervisor && !$isAdmin && !$isCEO) {
        $userFilter = " AND (u.supervisor_id = ? OR u.id = ?)";
        $userParams = [$currentUserId, $currentUserId];
    } elseif ($isTelesale && !$isAdmin && !$isCEO && !$isSupervisor) {
        $userFilter = " AND u.id = ?";
        $userParams = [$currentUserId];
    }

    // ===== Visible user list (Telesale + Supervisor Telesale only — role_id 6,7) =====
    $sqlUsers = "
        SELECT u.id, u.first_name, u.last_name, u.phone, u.supervisor_id, u.role
        FROM users u
        WHERE u.company_id = ?
          AND u.status = 'active'
          AND u.role_id IN (6, 7)
          $userFilter
        ORDER BY u.first_name, u.last_name
    ";
    $stmt = $pdo->prepare($sqlUsers);
    $stmt->execute(array_merge([$companyId], $userParams));
    $users = $stmt->fetchAll();

    $userIds = array_map(function ($u) { return (int) $u['id']; }, $users);
    if (empty($userIds)) {
        json_response([
            'success' => true,
            'data' => [
                'date' => $date,
                'target_per_day' => $dailyTarget,
                'team_totals' => empty_totals(),
                'hourly' => default_hourly(),
                'members' => [],
            ],
        ]);
        exit;
    }
    $userIdsIn = implode(',', $userIds);

    // ===== Per-member aggregates (also produces team totals) =====
    $sqlMember = "
        SELECT
            cl.matched_user_id AS user_id,
            COUNT(*) AS total_calls,
            SUM(CASE WHEN cl.status = 1 THEN 1 ELSE 0 END) AS connected_calls,
            SUM(CASE WHEN cl.status = 1 AND TIME_TO_SEC(cl.duration) >= 30 /* เกณฑ์ได้คุย = 30 วินาที */ THEN 1 ELSE 0 END) AS talked_calls,
            ROUND(COALESCE(SUM(TIME_TO_SEC(cl.duration)), 0) / 60, 2) AS total_minutes,
            SUM(CASE WHEN HOUR(cl.start_time) BETWEEN 0 AND 12 THEN 1 ELSE 0 END) AS morning_calls,
            SUM(CASE WHEN HOUR(cl.start_time) >= 13 THEN 1 ELSE 0 END) AS afternoon_calls,
            SUM(CASE WHEN HOUR(cl.start_time) BETWEEN 0 AND 12
                      AND cl.status = 1 AND TIME_TO_SEC(cl.duration) >= 30 /* เกณฑ์ได้คุย = 30 วินาที */ THEN 1 ELSE 0 END) AS morning_talked,
            SUM(CASE WHEN HOUR(cl.start_time) >= 13
                      AND cl.status = 1 AND TIME_TO_SEC(cl.duration) >= 30 /* เกณฑ์ได้คุย = 30 วินาที */ THEN 1 ELSE 0 END) AS afternoon_talked
        FROM call_import_logs cl
        WHERE cl.call_date = ?
          AND cl.matched_user_id IN ($userIdsIn)
        GROUP BY cl.matched_user_id
    ";
    $stmt = $pdo->prepare($sqlMember);
    $stmt->execute([$date]);
    $rows = $stmt->fetchAll();
    $byUser = [];
    foreach ($rows as $r) $byUser[(int) $r['user_id']] = $r;

    // ===== Hourly breakdown (team-wide, 0..23) =====
    $sqlHourly = "
        SELECT
            HOUR(cl.start_time) AS hr,
            COUNT(*) AS total_calls,
            SUM(CASE WHEN cl.status = 1 AND TIME_TO_SEC(cl.duration) >= 30 /* เกณฑ์ได้คุย = 30 วินาที */ THEN 1 ELSE 0 END) AS talked_calls
        FROM call_import_logs cl
        WHERE cl.call_date = ?
          AND cl.matched_user_id IN ($userIdsIn)
          AND cl.start_time IS NOT NULL
        GROUP BY HOUR(cl.start_time)
        ORDER BY hr
    ";
    $stmt = $pdo->prepare($sqlHourly);
    $stmt->execute([$date]);
    $hourlyRaw = $stmt->fetchAll();
    $hourlyMap = [];
    foreach ($hourlyRaw as $h) $hourlyMap[(int) $h['hr']] = $h;

    $hourly = [];
    for ($h = 8; $h <= 18; $h++) {
        $hr = $hourlyMap[$h] ?? null;
        $hourly[] = [
            'hour' => $h,
            'label' => sprintf('%02d:00', $h),
            'period' => $h <= 12 ? 'morning' : 'afternoon',
            'total_calls' => $hr ? (int) $hr['total_calls'] : 0,
            'talked_calls' => $hr ? (int) $hr['talked_calls'] : 0,
        ];
    }

    // ===== Members + team totals =====
    $totals = empty_totals();
    $members = [];
    foreach ($users as $u) {
        $uid = (int) $u['id'];
        $r = $byUser[$uid] ?? null;
        $totalCalls     = $r ? (int) $r['total_calls'] : 0;
        $connectedCalls = $r ? (int) $r['connected_calls'] : 0;
        $talkedCalls    = $r ? (int) $r['talked_calls'] : 0;
        $totalMinutes   = $r ? (float) $r['total_minutes'] : 0.0;
        $morningCalls   = $r ? (int) $r['morning_calls'] : 0;
        $afternoonCalls = $r ? (int) $r['afternoon_calls'] : 0;

        $totals['total_calls']     += $totalCalls;
        $totals['connected_calls'] += $connectedCalls;
        $totals['talked_calls']    += $talkedCalls;
        $totals['total_minutes']   += $totalMinutes;
        if ($totalCalls > 0) $totals['active_users'] += 1;

        $members[] = [
            'user_id'         => $uid,
            'first_name'      => $u['first_name'],
            'last_name'       => $u['last_name'],
            'name'            => trim(($u['first_name'] ?? '') . ' ' . ($u['last_name'] ?? '')),
            'phone'           => $u['phone'],
            'role'            => $u['role'],
            'total_calls'     => $totalCalls,
            'connected_calls' => $connectedCalls,
            'talked_calls'    => $talkedCalls,
            'total_minutes'   => round($totalMinutes, 1),
            'morning_calls'   => $morningCalls,
            'afternoon_calls' => $afternoonCalls,
            'target_progress' => $dailyTarget > 0 ? round($talkedCalls / $dailyTarget, 3) : 0,
        ];
    }

    $totals['talk_rate'] = $totals['total_calls'] > 0
        ? round($totals['talked_calls'] / $totals['total_calls'], 3)
        : 0;
    $totals['answer_rate'] = $totals['total_calls'] > 0
        ? round($totals['connected_calls'] / $totals['total_calls'], 3)
        : 0;
    $totals['total_minutes'] = round($totals['total_minutes'], 1);

    json_response([
        'success' => true,
        'data' => [
            'date' => $date,
            'target_per_day' => $dailyTarget,
            'team_totals' => $totals,
            'hourly' => $hourly,
            'members' => $members,
            'viewer' => [
                'user_id' => $currentUserId,
                'role' => $user['role'],
                'is_supervisor' => $isSupervisor,
                'is_admin' => $isAdmin || $isCEO,
            ],
        ],
    ]);

} catch (Throwable $e) {
    error_log("daily_monitoring.php error: " . $e->getMessage());
    json_response([
        'success' => false,
        'message' => 'Server error',
        'detail' => $e->getMessage(),
    ], 500);
}

function empty_totals(): array
{
    return [
        'total_calls' => 0,
        'connected_calls' => 0,
        'talked_calls' => 0,
        'total_minutes' => 0.0,
        'talk_rate' => 0,
        'answer_rate' => 0,
        'active_users' => 0,
    ];
}

function default_hourly(): array
{
    $rows = [];
    for ($h = 8; $h <= 18; $h++) {
        $rows[] = [
            'hour' => $h,
            'label' => sprintf('%02d:00', $h),
            'period' => $h <= 12 ? 'morning' : 'afternoon',
            'total_calls' => 0,
            'talked_calls' => 0,
        ];
    }
    return $rows;
}
