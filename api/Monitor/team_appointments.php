<?php
/**
 * Monitor — Team Appointments
 *
 * Lists appointments for telesale team members so a Supervisor can monitor
 * who has follow-ups today, this week, and what's overdue.
 *
 * Statuses in `appointments` (Thai):
 *   'รอดำเนินการ' (pending) | 'ใหม่' (new) | 'เสร็จสิ้น' (done)
 *
 * Active = status IN ('รอดำเนินการ','ใหม่')
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
    $date = $_GET['date'] ?? date('Y-m-d');
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
        json_response(['success' => false, 'message' => 'Invalid date'], 400);
        exit;
    }
    $rangeDays = isset($_GET['range_days']) ? max(1, min(30, (int) $_GET['range_days'])) : 7;

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
        SELECT u.id, u.first_name, u.last_name, u.phone, u.role
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
        json_response(['success' => true, 'data' => [
            'date' => $date,
            'range_days' => $rangeDays,
            'team_totals' => ['selected' => 0, 'today' => 0, 'week' => 0, 'overdue' => 0],
            'members' => [],
            'appointments' => [],
        ]]);
        exit;
    }
    $idsIn = implode(',', $userIds);

    // Per-member counts (selected day / next N days window / overdue)
    $sqlPer = "
        SELECT u.id AS uid,
            SUM(CASE WHEN DATE(a.date) = ? AND a.status IN ('รอดำเนินการ','ใหม่') THEN 1 ELSE 0 END) AS selected_day,
            SUM(CASE WHEN DATE(a.date) BETWEEN ? AND DATE_ADD(?, INTERVAL ? DAY)
                          AND a.status IN ('รอดำเนินการ','ใหม่') THEN 1 ELSE 0 END) AS week_window,
            SUM(CASE WHEN DATE(a.date) < CURDATE() AND a.status IN ('รอดำเนินการ','ใหม่') THEN 1 ELSE 0 END) AS overdue
        FROM users u
        LEFT JOIN customers c ON c.assigned_to = u.id
        LEFT JOIN appointments a ON a.customer_id = c.customer_id AND a.date >= DATE_SUB(?, INTERVAL 90 DAY)
        WHERE u.id IN ($idsIn)
        GROUP BY u.id
    ";
    $stmt = $pdo->prepare($sqlPer);
    $stmt->execute([$date, $date, $date, $rangeDays - 1, $date]);
    $perUser = [];
    foreach ($stmt->fetchAll() as $r) {
        $perUser[(int) $r['uid']] = [
            'selected' => (int) $r['selected_day'],
            'week'     => (int) $r['week_window'],
            'overdue'  => (int) $r['overdue'],
        ];
    }

    // Appointment list for the selected day (or window) — limit 200
    $sqlList = "
        SELECT a.id, a.date, a.status, a.notes, a.title,
               c.customer_id AS customer_id,
               TRIM(CONCAT(IFNULL(c.first_name,''), ' ', IFNULL(c.last_name,''))) AS customer_name,
               c.phone AS customer_phone,
               u.id AS agent_id,
               TRIM(CONCAT(IFNULL(u.first_name,''), ' ', IFNULL(u.last_name,''))) AS agent_name
        FROM appointments a
        JOIN customers c ON c.customer_id = a.customer_id
        JOIN users u ON u.id = c.assigned_to
        WHERE u.id IN ($idsIn)
          AND a.status IN ('รอดำเนินการ','ใหม่')
          AND DATE(a.date) BETWEEN ? AND DATE_ADD(?, INTERVAL ? DAY)
        ORDER BY a.date ASC
        LIMIT 200
    ";
    $stmt = $pdo->prepare($sqlList);
    $stmt->execute([$date, $date, $rangeDays - 1]);
    $appts = $stmt->fetchAll();

    // Team totals
    $totals = ['selected' => 0, 'today' => 0, 'week' => 0, 'overdue' => 0];
    foreach ($perUser as $p) {
        $totals['selected'] += $p['selected'];
        $totals['week']     += $p['week'];
        $totals['overdue']  += $p['overdue'];
    }
    // Today total — re-query for "today" specifically (in case `date` != today)
    $stmt = $pdo->prepare("
        SELECT COUNT(*) AS c FROM appointments a
        JOIN customers c ON c.customer_id = a.customer_id
        WHERE c.assigned_to IN ($idsIn)
          AND a.status IN ('รอดำเนินการ','ใหม่')
          AND DATE(a.date) = CURDATE()
    ");
    $stmt->execute();
    $totals['today'] = (int) ($stmt->fetch()['c'] ?? 0);

    // Build member rows
    $rows = [];
    foreach ($members as $m) {
        $uid = (int) $m['id'];
        $p = $perUser[$uid] ?? ['selected' => 0, 'week' => 0, 'overdue' => 0];
        $rows[] = [
            'user_id'    => $uid,
            'first_name' => $m['first_name'],
            'last_name'  => $m['last_name'],
            'name'       => trim(($m['first_name'] ?? '') . ' ' . ($m['last_name'] ?? '')),
            'role'       => $m['role'],
            'selected'   => $p['selected'],
            'week'       => $p['week'],
            'overdue'    => $p['overdue'],
        ];
    }

    json_response([
        'success' => true,
        'data' => [
            'date' => $date,
            'range_days' => $rangeDays,
            'team_totals' => $totals,
            'members' => $rows,
            'appointments' => $appts,
        ],
    ]);

} catch (Throwable $e) {
    error_log("Monitor/team_appointments.php: " . $e->getMessage());
    json_response(['success' => false, 'message' => 'Server error', 'detail' => $e->getMessage()], 500);
}
