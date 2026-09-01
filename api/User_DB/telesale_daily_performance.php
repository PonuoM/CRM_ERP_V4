<?php
/**
 * Telesale Daily Performance API — one row per (agent, day) for a date range.
 *
 * TIME OF DAY (the reason this file was rewritten):
 *   call_import_logs.call_date is a **DATE** column — the clock lives in `start_time`. The old
 *   filter read `TIME(cl.call_date) BETWEEN ? AND ?`, which is 00:00:00 for every row ever
 *   imported, so the moment anyone narrowed the hour picker to, say, 09:00–18:00 every call
 *   metric on the screen collapsed to zero while sales kept showing. It now filters `start_time`.
 *   The "business hours" default that used to sit here (Mon-Fri 09-18 / weekend 09-16:30) was
 *   dead code — its guard compared $startTime, which had already had ':00' appended, against
 *   '00:00' — and is gone rather than revived: a filter the UI does not show must not silently
 *   shrink the numbers.
 *
 * WHICH DAY A SALE BELONGS TO:
 *   `order_items.created_at` — the moment the agent actually keyed the line — not the parent
 *   bill's `order_date`. Upsell lines get added to older bills, and filing them under the bill's
 *   date moves that revenue to a day the agent did not work (Aug 2026: 82 lines / ฿38k).
 *   `created_at` carries no index, so the parent bill's indexed `order_date` still prunes the
 *   scan with a window widened by ITEM_LAG_DAYS; the exact bound is then applied on created_at.
 *
 * Params: start_date, end_date (YYYY-MM-DD), start_time, end_time (HH:MM),
 *         roles (csv of telesale|adminpage, default telesale), teams (csv), agents (csv),
 *         inactive=1 (include people who have left),
 *         all_teams=1 (supervisors only — widen scope from own team to the whole company)
 */

require_once __DIR__ . '/../config.php';
// กติกาเสาร์-อาทิตย์ฐาน 6 ชม. ย้ายไปรวมศูนย์ที่ attendance_kpi.php ให้ทุกหน้าใช้ชุดเดียวกัน
require_once __DIR__ . '/../attendance_kpi.php';

cors();

/** How far back a bill may sit behind the line keyed against it. Observed max in 2026: 76 days. */
const ITEM_LAG_DAYS = 120;

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
    $isSupervisor = strpos($role, 'supervisor') !== false;
    $isAdminPage = strpos($role, 'admin page') !== false;
    $isAdmin = strpos($role, 'admin') !== false && !$isSupervisor && !$isAdminPage;
    $isCEO = strpos($role, 'ceo') !== false;
    $isTelesale = strpos($role, 'telesale') !== false || $isAdminPage;

    if (!$isAdmin && !$isSupervisor && !$isCEO && !$isTelesale) {
        json_response(['success' => false, 'message' => 'Access denied. Valid role required.'], 403);
        exit;
    }

    $startDate = isset($_GET['start_date']) ? $_GET['start_date'] : date('Y-m-d');
    $endDate = isset($_GET['end_date']) ? $_GET['end_date'] : date('Y-m-d');
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $startDate) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $endDate)) {
        json_response(['success' => false, 'message' => 'Invalid date format. Use YYYY-MM-DD.'], 400);
        exit;
    }
    if ($endDate < $startDate) { $tmp = $startDate; $startDate = $endDate; $endDate = $tmp; }

    // Whole-minute bounds: "ถึง 16:00" has to keep an order keyed at 16:00:45.
    $startTime = (isset($_GET['start_time']) && $_GET['start_time'] !== '') ? $_GET['start_time'] . ':00' : '00:00:00';
    $endTime = (isset($_GET['end_time']) && $_GET['end_time'] !== '') ? $_GET['end_time'] . ':59' : '23:59:59';

    $csv = function ($name) {
        if (!isset($_GET[$name]) || $_GET[$name] === '') return [];
        $out = [];
        foreach (explode(',', (string) $_GET[$name]) as $v) {
            $v = trim($v);
            if ($v !== '') $out[] = $v;
        }
        return array_values(array_unique($out));
    };
    $wantRoles = $csv('roles');
    if (empty($wantRoles)) $wantRoles = ['telesale'];
    $roleIds = [];
    if (in_array('telesale', $wantRoles, true)) { $roleIds[] = 6; $roleIds[] = 7; }
    if (in_array('adminpage', $wantRoles, true)) { $roleIds[] = 3; }
    if (empty($roleIds)) $roleIds = [6, 7];
    $filterTeams = $csv('teams');
    $filterAgents = array_values(array_filter(array_map('intval', $csv('agents')), function ($n) { return $n > 0; }));
    $showInactive = isset($_GET['inactive']) && $_GET['inactive'] === '1';   // people who have left

    // Supervisors see every team on the Telesale Performance screen — a deliberate grant, asked for
    // so heads can compare their team against the others. It is opt-in per request rather than a
    // change to $isSupervisor because SalesDashboard reads this same endpoint for personal/team KPI
    // and must keep showing a supervisor their OWN team only. The flag is honoured for supervisors
    // alone: a plain telesale sending all_teams=1 still gets just themselves.
    $seeAllTeams = isset($_GET['all_teams']) && $_GET['all_teams'] === '1' && $isSupervisor;

    $TIER_NEW_KEYS = [38, 46, 47];
    $TIER_CORE_KEYS = [39, 40];
    $TIER_REVIVAL_KEYS = [49, 50, 58, 59];   // 58/59 were split out of the retired 48 in May 2026
    $newKeysIn = implode(',', $TIER_NEW_KEYS);
    $coreKeysIn = implode(',', $TIER_CORE_KEYS);
    $revivalKeysIn = implode(',', $TIER_REVIVAL_KEYS);

    // ---- Agents in scope --------------------------------------------------
    $supById = [];
    $teamIdToSup = [];
    $sv = $pdo->prepare("SELECT id, first_name, team_id FROM users WHERE role_id = 6 AND company_id = ?");
    $sv->execute([$companyId]);
    foreach ($sv->fetchAll(PDO::FETCH_ASSOC) as $s) {
        $supById[(int) $s['id']] = $s['first_name'];
        if ($s['team_id'] !== null && $s['team_id'] !== '' && (int) $s['team_id'] !== 0) {
            $teamIdToSup[(int) $s['team_id']] = (int) $s['id'];
        }
    }
    $resolveTeam = function ($u) use ($supById, $teamIdToSup) {
        $rid = (int) $u['role_id'];
        if ($rid === 3) return ['key' => 'admin_page', 'name' => 'Admin Page'];
        if ($rid === 6) return ['key' => (string) (int) $u['id'], 'name' => $u['first_name'] ?: ('#' . $u['id'])];
        $sid = $u['supervisor_id'] !== null ? (int) $u['supervisor_id'] : 0;
        if ($sid && isset($supById[$sid])) return ['key' => (string) $sid, 'name' => $supById[$sid]];
        $tid = $u['team_id'] !== null ? (int) $u['team_id'] : 0;
        if ($tid && isset($teamIdToSup[$tid])) return ['key' => (string) $teamIdToSup[$tid], 'name' => $supById[$teamIdToSup[$tid]]];
        return ['key' => '0', 'name' => 'ไม่มีทีม'];
    };

    $rolePh = implode(',', array_fill(0, count($roleIds), '?'));
    $uStmt = $pdo->prepare("SELECT id, first_name, last_name, role, role_id, team_id, supervisor_id, status
                            FROM users WHERE role_id IN ($rolePh) AND company_id = ?");
    $uStmt->execute(array_merge($roleIds, [$companyId]));

    $userMap = [];
    foreach ($uStmt->fetchAll(PDO::FETCH_ASSOC) as $u) {
        $id = (int) $u['id'];
        $t = $resolveTeam($u);
        $userMap[$id] = [
            'id' => $id,
            'name' => trim(($u['first_name'] ?? '') . ' ' . ($u['last_name'] ?? '')),
            'first_name' => $u['first_name'],
            'team_key' => $t['key'],
            'team_name' => $t['name'],
            'role_id' => (int) $u['role_id'],
            'role_label' => (int) $u['role_id'] === 6 ? 'Sup' : ((int) $u['role_id'] === 3 ? 'Admin Page' : 'Telesale'),
            'is_inactive' => strtolower((string) $u['status']) !== 'active',
        ];
    }

    $emptyOut = function () {
        json_response(['success' => true, 'data' => ['dailyRecords' => [], 'users' => []]]);
    };
    if (empty($userMap)) { $emptyOut(); exit; }

    if ($isAdmin || $isCEO || $seeAllTeams) {
        $visibleIds = array_keys($userMap);
    } elseif ($isSupervisor) {
        $visibleIds = array_values(array_filter(array_keys($userMap), function ($id) use ($userMap, $currentUserId) {
            return $userMap[$id]['team_key'] === (string) $currentUserId || $id === $currentUserId;
        }));
    } else {
        $visibleIds = isset($userMap[$currentUserId]) ? [$currentUserId] : [];
    }
    if (!$showInactive) {
        $visibleIds = array_values(array_filter($visibleIds, function ($id) use ($userMap) {
            return !$userMap[$id]['is_inactive'];
        }));
    }
    $activeIds = $visibleIds;
    if (!empty($filterTeams)) {
        $teamSet = array_flip(array_map('strval', $filterTeams));
        $activeIds = array_values(array_filter($activeIds, function ($id) use ($userMap, $teamSet) {
            return isset($teamSet[$userMap[$id]['team_key']]);
        }));
    }
    if (!empty($filterAgents)) {
        $agentSet = array_flip($filterAgents);
        $activeIds = array_values(array_filter($activeIds, function ($id) use ($agentSet) { return isset($agentSet[$id]); }));
    }
    if (empty($activeIds)) { $emptyOut(); exit; }
    $idPh = implode(',', array_fill(0, count($activeIds), '?'));

    // ---- Pre-fill the grid so every (agent, day) exists even with zero activity
    $dateStart = new DateTime($startDate);
    $dateEnd = new DateTime($endDate);
    $dateEnd->modify('+1 day');
    $period = new DatePeriod($dateStart, DateInterval::createFromDateString('1 day'), $dateEnd);

    $emptyMetrics = [
        'totalCalls' => 0, 'connectedCalls' => 0, 'talkedCalls' => 0, 'missedCalls' => 0,
        'totalMinutes' => 0, 'answerRate' => 0, 'workingHours' => 0, 'workingDays' => 0,
        'totalSales' => 0, 'upsellSales' => 0, 'cancelledSales' => 0, 'returnedSales' => 0, 'grossSales' => 0,
        'totalOrders' => 0, 'upsellOrders' => 0, 'grossOrders' => 0, 'netOrders' => 0,
        'newCustOrders' => 0, 'newCustSales' => 0, 'coreCustOrders' => 0, 'coreCustSales' => 0,
        'revivalCustOrders' => 0, 'revivalCustSales' => 0,
        'bioSales' => 0, 'fertilizerSales' => 0, 'otherSales' => 0,
    ];
    $dailyData = [];
    foreach ($period as $dt) {
        $d = $dt->format('Y-m-d');
        $dailyData[$d] = [];
        foreach ($activeIds as $uid) {
            $m = $userMap[$uid];
            $dailyData[$d][$uid] = [
                'userId' => $uid,
                'name' => $m['name'],
                'team' => $m['team_name'],
                'teamKey' => $m['team_key'],
                'roleLabel' => $m['role_label'],
                'date' => $d,
                'metrics' => $emptyMetrics,
            ];
        }
    }

    $endDateEx = date('Y-m-d', strtotime($endDate . ' +1 day'));

    // ---- 1. Calls. Day from call_date (a DATE), hour-of-day from start_time.
    $sqlCalls = "
        SELECT call_date AS call_day, matched_user_id AS user_id,
               COUNT(*) AS total_calls,
               SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) AS connected_calls,
               SUM(CASE WHEN status = 1 AND TIME_TO_SEC(duration) >= 30 THEN 1 ELSE 0 END) AS talked_calls,
               SUM(CASE WHEN status = 0 THEN 1 ELSE 0 END) AS missed_calls,
               ROUND(COALESCE(SUM(TIME_TO_SEC(duration)), 0) / 60, 2) AS total_minutes
        FROM call_import_logs
        WHERE matched_user_id IN ($idPh)
          AND call_date >= ? AND call_date < ?
          AND start_time BETWEEN ? AND ?
        GROUP BY call_date, matched_user_id
    ";
    $stmt = $pdo->prepare($sqlCalls);
    $stmt->execute(array_merge($activeIds, [$startDate, $endDateEx, $startTime, $endTime]));
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $d = $row['call_day'];
        $uid = (int) $row['user_id'];
        if (!isset($dailyData[$d][$uid])) continue;
        $m = &$dailyData[$d][$uid]['metrics'];
        $m['totalCalls'] = (int) $row['total_calls'];
        $m['connectedCalls'] = (int) $row['connected_calls'];
        $m['talkedCalls'] = (int) $row['talked_calls'];
        $m['missedCalls'] = (int) $row['missed_calls'];
        $m['totalMinutes'] = (float) $row['total_minutes'];
        $m['answerRate'] = $m['totalCalls'] > 0 ? round(($m['connectedCalls'] / $m['totalCalls']) * 100, 1) : 0;
        unset($m);
    }

    // ---- 2. Orders & sales, keyed to the day the LINE was created.
    // The order_date window is only there to let idx_orders_company_date prune the scan; the
    // authoritative bound is on oi.created_at.
    $lineAmount = "COALESCE(oi.net_total, oi.quantity * oi.price_per_unit)";
    $liveItem = "(oi.is_freebie = 0 OR oi.is_freebie IS NULL) AND oi.parent_item_id IS NULL";
    $alive = "o.order_status NOT IN ('Cancelled', 'BadDebt', 'Returned') AND (ob.status IS NULL OR ob.status <> 'RETURNED')";
    $itemWindowStart = date('Y-m-d', strtotime($startDate . ' -' . ITEM_LAG_DAYS . ' days'));
    $itemWindowEnd = date('Y-m-d', strtotime($endDate . ' +2 days'));

    $sqlOrders = "
        SELECT DATE(oi.created_at) AS order_day, oi.creator_id AS user_id,
               COUNT(DISTINCT o.id) AS gross_orders,
               COALESCE(SUM($lineAmount), 0) AS gross_sales,
               COALESCE(SUM(CASE WHEN o.order_status = 'Cancelled' THEN $lineAmount ELSE 0 END), 0) AS cancelled_sales,
               COALESCE(SUM(CASE WHEN o.order_status = 'Returned' OR ob.status = 'RETURNED' THEN $lineAmount ELSE 0 END), 0) AS returned_sales,
               COALESCE(SUM(CASE WHEN $alive AND (oi.basket_key_at_sale IS NULL OR oi.basket_key_at_sale <> 51) THEN $lineAmount ELSE 0 END), 0) AS net_regular_sales,
               COUNT(DISTINCT CASE WHEN $alive AND (oi.basket_key_at_sale IS NULL OR oi.basket_key_at_sale <> 51) THEN o.id END) AS net_regular_orders,
               COALESCE(SUM(CASE WHEN $alive AND oi.basket_key_at_sale = 51 THEN $lineAmount ELSE 0 END), 0) AS net_upsell_sales,
               COUNT(DISTINCT CASE WHEN $alive AND oi.basket_key_at_sale = 51 THEN o.id END) AS net_upsell_orders,
               COUNT(DISTINCT CASE WHEN $alive THEN o.id END) AS net_orders,
               COUNT(DISTINCT CASE WHEN $alive AND COALESCE(oi.basket_key_at_sale, o.basket_key_at_sale) IN ($newKeysIn) THEN o.id END) AS new_orders,
               COALESCE(SUM(CASE WHEN $alive AND COALESCE(oi.basket_key_at_sale, o.basket_key_at_sale) IN ($newKeysIn) THEN $lineAmount ELSE 0 END), 0) AS new_sales,
               COUNT(DISTINCT CASE WHEN $alive AND COALESCE(oi.basket_key_at_sale, o.basket_key_at_sale) IN ($coreKeysIn) THEN o.id END) AS core_orders,
               COALESCE(SUM(CASE WHEN $alive AND COALESCE(oi.basket_key_at_sale, o.basket_key_at_sale) IN ($coreKeysIn) THEN $lineAmount ELSE 0 END), 0) AS core_sales,
               COUNT(DISTINCT CASE WHEN $alive AND COALESCE(oi.basket_key_at_sale, o.basket_key_at_sale) IN ($revivalKeysIn) THEN o.id END) AS revival_orders,
               COALESCE(SUM(CASE WHEN $alive AND COALESCE(oi.basket_key_at_sale, o.basket_key_at_sale) IN ($revivalKeysIn) THEN $lineAmount ELSE 0 END), 0) AS revival_sales,
               COALESCE(SUM(CASE WHEN $alive AND p.category LIKE '%ชีวภัณฑ์%' THEN $lineAmount ELSE 0 END), 0) AS bio_sales,
               COALESCE(SUM(CASE WHEN $alive AND p.category LIKE '%ปุ๋ย%' THEN $lineAmount ELSE 0 END), 0) AS fertilizer_sales,
               COALESCE(SUM(CASE WHEN $alive AND (p.category IS NULL OR (p.category NOT LIKE '%ชีวภัณฑ์%' AND p.category NOT LIKE '%ปุ๋ย%')) THEN $lineAmount ELSE 0 END), 0) AS other_sales
        FROM order_items oi
        JOIN orders o ON oi.parent_order_id = o.id
        LEFT JOIN order_boxes ob ON ob.sub_order_id = oi.order_id
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE oi.creator_id IN ($idPh)
          AND o.company_id = ?
          AND o.order_date >= ? AND o.order_date < ?
          AND oi.created_at >= ? AND oi.created_at < ?
          AND TIME(oi.created_at) BETWEEN ? AND ?
          AND $liveItem
        GROUP BY DATE(oi.created_at), oi.creator_id
    ";
    $stmt = $pdo->prepare($sqlOrders);
    $stmt->execute(array_merge($activeIds, [
        $companyId, $itemWindowStart, $itemWindowEnd,
        $startDate . ' 00:00:00', $endDateEx . ' 00:00:00',
        $startTime, $endTime,
    ]));
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $d = $row['order_day'];
        $uid = (int) $row['user_id'];
        if (!isset($dailyData[$d][$uid])) continue;
        $m = &$dailyData[$d][$uid]['metrics'];
        $m['grossOrders'] = (int) $row['gross_orders'];
        $m['grossSales'] = (float) $row['gross_sales'];
        $m['cancelledSales'] = (float) $row['cancelled_sales'];
        $m['returnedSales'] = (float) $row['returned_sales'];
        $m['totalSales'] = (float) $row['net_regular_sales'];
        $m['totalOrders'] = (int) $row['net_regular_orders'];
        $m['upsellSales'] = (float) $row['net_upsell_sales'];
        $m['upsellOrders'] = (int) $row['net_upsell_orders'];
        $m['netOrders'] = (int) $row['net_orders'];       // DISTINCT across regular+upsell, no double count
        $m['newCustOrders'] = (int) $row['new_orders'];
        $m['newCustSales'] = (float) $row['new_sales'];
        $m['coreCustOrders'] = (int) $row['core_orders'];
        $m['coreCustSales'] = (float) $row['core_sales'];
        $m['revivalCustOrders'] = (int) $row['revival_orders'];
        $m['revivalCustSales'] = (float) $row['revival_sales'];
        $m['bioSales'] = (float) $row['bio_sales'];
        $m['fertilizerSales'] = (float) $row['fertilizer_sales'];
        $m['otherSales'] = (float) $row['other_sales'];
        unset($m);
    }

    // ---- 3. Attendance
    // DB เก็บ attendance_value เป็นสัดส่วนของวัน 8 ชม. — เพดาน 1 วันต่อวัน
    // "วันทำงาน" ของ KPI ไม่เท่ากับชั่วโมงหาร 8: เสาร์-อาทิตย์ของ role 6/7 ทำงาน 6 ชม.
    // ก็นับเป็น 1 วันเต็ม (ดู kpi_hours_per_work_day) Admin Page ใช้ 8 ชม. ทุกวัน
    $roleByUser = [];
    foreach ($activeIds as $uid) {
        $roleByUser[(int) $uid] = (int) ($userMap[(int) $uid]['role_id'] ?? 0);
    }

    $stmt = $pdo->prepare("SELECT work_date AS work_day, user_id, SUM(attendance_value) AS working_days
                           FROM user_daily_attendance
                           WHERE work_date >= ? AND work_date < ? AND user_id IN ($idPh)
                           GROUP BY work_date, user_id");
    $stmt->execute(array_merge([$startDate, $endDateEx], $activeIds));
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $d = $row['work_day'];
        $uid = (int) $row['user_id'];
        if (!isset($dailyData[$d][$uid])) continue;
        $dailyData[$d][$uid]['metrics']['workingHours'] = min(floatval($row['working_days']), 1.0) * 8;
        $dailyData[$d][$uid]['metrics']['workingDays'] = kpi_working_day_fraction($row['working_days'], $d, $roleByUser[$uid] ?? 0);
    }

    $flatData = [];
    foreach ($dailyData as $d => $perUser) {
        foreach ($perUser as $record) $flatData[] = $record;
    }

    $usersList = [];
    foreach ($activeIds as $uid) {
        $m = $userMap[$uid];
        $usersList[] = ['id' => $uid, 'name' => $m['name'], 'team' => $m['team_name'], 'teamKey' => $m['team_key']];
    }

    json_response(['success' => true, 'data' => ['dailyRecords' => $flatData, 'users' => $usersList]]);

} catch (Exception $e) {
    error_log('Telesale Daily Performance API Error: ' . $e->getMessage());
    json_response(['success' => false, 'message' => 'Internal server error: ' . $e->getMessage()], 500);
}
