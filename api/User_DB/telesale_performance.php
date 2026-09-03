<?php
/**
 * Telesale Performance Dashboard API — monthly summary, with an optional single-day mode.
 *
 * Shape of the answer: one row per agent (calls, orders, sales, attendance, target), plus team
 * totals, plus four rankings. The per-basket breakdown that used to live here as three lumped
 * column groups now has its own endpoint (User_DB/telesale_segment_matrix.php) — the counts kept
 * here are only the three roll-up cards at the top of the page.
 *
 * DEFINITIONS — these were drifting apart across the page; they are now stated once:
 *
 *   ยอดขาย        net of freebies, and net of dead bills: Cancelled, BadDebt AND Returned.
 *                 Returned used to be counted as revenue here (Aug 2026: ฿50,770) while the daily
 *                 table below it subtracted the same bills, so the two could never reconcile.
 *   ออเดอร์        COUNT(DISTINCT order id) over ALL of the agent's items in the period. Counting
 *                 regular and upsell separately and adding them double-counted every bill that
 *                 carried both (Aug 2026: 76 bills).
 *   % ปิดการขาย    orders ÷ ได้คุย, for an agent AND for the team. The team card used to divide by
 *                 รับสาย and the daily table by every dialled call — three numbers, one label.
 *   ได้คุย         distinct customers reached: outbound calls where status = 1 AND duration >= 30s,
 *                 counted per PERSON (talkedCallCount keeps the raw call count alongside it).
 *                 Team totals add up per-agent head counts, so one customer reached by two agents
 *                 counts on both — the same convention the segment matrix uses.
 *   ลูกค้าที่ดูแล   customers in hand at the END of the month, from customer_ownership_snapshots.
 *                 Read live it always showed TODAY's book — so any past month was reported against
 *                 a book that had already been reclaimed. Live is the fallback for the current
 *                 (unfinished) month and is flagged via owned_source.
 *
 * SEGMENTS (roll-up cards): ลูกค้าใหม่ = 38,46,47 · ลูกค้าเก่า = 39,40 · ลูกค้าขุด = 49,50,58,59.
 *   58/59 (ถังกลาง 6-9 / 9-12 เดือน) were missing entirely: they were split out of 48 (6-12 เดือน)
 *   in May 2026 and nothing was ever taught about them, hiding 21% of the customer book.
 *   48 is retired (is_active = 0) and no longer referenced.
 *
 * PERFORMANCE: every date predicate is a sargable range. `YEAR(order_date)=? AND MONTH(...)=?`
 *   made MySQL walk 197k rows of `orders` per query (six of them per request); the range form
 *   reads ~7k. `DATE_FORMAT(call_date,'%Y-%m')=?` scanned all 593k call rows; the range form uses
 *   idx_cil_calldate_user. Agents are resolved to an id list once, so no query joins `users`.
 *
 * Params: year, month, date (YYYY-MM-DD -> single-day mode),
 *         roles (csv of telesale|adminpage, default telesale), teams (csv of team keys),
 *         agents (csv of user ids), inactive=1 (include people who have left),
 *         all_teams=1 (supervisors only — widen scope from own team to the whole company)
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../attendance_kpi.php';

cors();

/** Bills that are not revenue. Shared by every sales aggregate in this file so the rule cannot drift. */
const TP_DEAD_STATUSES = ['Cancelled', 'BadDebt', 'Returned'];

try {
    $pdo = db_connect();
    $user = get_authenticated_user($pdo);

    if (!$user) {
        json_response(['success' => false, 'message' => 'Unauthorized'], 401);
        exit;
    }

    $companyId = (int) $user['company_id'];
    $currentUserId = (int) $user['id'];
    $currentUserRole = strtolower($user['role'] ?? '');

    $isSupervisor = strpos($currentUserRole, 'supervisor') !== false;
    $isAdminPage = strpos($currentUserRole, 'admin page') !== false;
    $isAdmin = strpos($currentUserRole, 'admin') !== false && !$isSupervisor && !$isAdminPage;
    $isCEO = strpos($currentUserRole, 'ceo') !== false;
    $isTelesale = strpos($currentUserRole, 'telesale') !== false || $isAdminPage;

    if (!$isAdmin && !$isSupervisor && !$isCEO && !$isTelesale) {
        json_response(['success' => false, 'message' => 'Access denied. Valid role required.'], 403);
        exit;
    }

    // ---- Period -----------------------------------------------------------
    $year = isset($_GET['year']) ? intval($_GET['year']) : intval(date('Y'));
    $month = isset($_GET['month']) ? intval($_GET['month']) : intval(date('m'));
    $specificDate = isset($_GET['date']) ? $_GET['date'] : null;
    $isDaily = !empty($specificDate) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $specificDate);

    if ($isDaily) {
        $dayStart = $specificDate . ' 00:00:00';
        $dayEndEx = date('Y-m-d 00:00:00', strtotime($specificDate . ' +1 day'));
        $callFrom = $specificDate;
        $callToEx = date('Y-m-d', strtotime($specificDate . ' +1 day'));
        $ownYear = intval(substr($specificDate, 0, 4));
        $ownMonth = intval(substr($specificDate, 5, 2));
    } else {
        $monthStart = sprintf('%04d-%02d-01', $year, $month);
        $dayStart = $monthStart . ' 00:00:00';
        $dayEndEx = date('Y-m-d 00:00:00', strtotime($monthStart . ' +1 month'));
        $callFrom = $monthStart;
        $callToEx = date('Y-m-d', strtotime($monthStart . ' +1 month'));
        $ownYear = $year;
        $ownMonth = $month;
    }
    $ownMonthStart = sprintf('%04d-%02d-01', $ownYear, $ownMonth);

    // ---- Tier definitions (roll-up cards) ---------------------------------
    $TIER_NEW_KEYS = [38, 46, 47];
    $TIER_CORE_KEYS = [39, 40];
    $TIER_REVIVAL_KEYS = [49, 50, 58, 59];
    $newKeysIn = implode(',', $TIER_NEW_KEYS);
    $coreKeysIn = implode(',', $TIER_CORE_KEYS);
    $revivalKeysIn = implode(',', $TIER_REVIVAL_KEYS);
    $allSegmentKeysIn = implode(',', array_merge($TIER_NEW_KEYS, $TIER_CORE_KEYS, $TIER_REVIVAL_KEYS));

    // ---- Filters ----------------------------------------------------------
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

    // ---- Agents in scope --------------------------------------------------
    // Resolved once into a plain id list. Every aggregate below filters on that list, so none of
    // them has to join `users` or re-apply the role LIKE test.
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
    $uStmt = $pdo->prepare("SELECT id, first_name, last_name, phone, role, role_id, team_id, supervisor_id, status
                            FROM users WHERE role_id IN ($rolePh) AND company_id = ?");
    $uStmt->execute(array_merge($roleIds, [$companyId]));

    $userMap = [];
    foreach ($uStmt->fetchAll(PDO::FETCH_ASSOC) as $u) {
        $id = (int) $u['id'];
        $rid = (int) $u['role_id'];
        $t = $resolveTeam($u);
        $userMap[$id] = [
            'id' => $id,
            'first_name' => $u['first_name'],
            'last_name' => $u['last_name'],
            'phone' => $u['phone'],
            'role_id' => $rid,
            'role_label' => $rid === 6 ? 'Sup' : ($rid === 3 ? 'Admin Page' : 'Telesale'),
            'team_key' => $t['key'],
            'team_name' => $t['name'],
            'is_inactive' => strtolower((string) $u['status']) !== 'active',
            'has_book' => $rid !== 3,   // Admin Page holds no customers and never dials via the CDR
        ];
    }

    $emptyPayload = function () use ($year, $month) {
        json_response(['success' => true, 'data' => [
            'period' => ['year' => $year, 'month' => $month],
            'teamTotals' => new stdClass(), 'telesaleCount' => 0, 'previousMonthSales' => 0,
            'ownedSource' => 'live', 'teams' => [], 'agents' => [],
            'rankings' => ['byConversion' => [], 'bySales' => [], 'byCoreRate' => [], 'byUpsell' => []],
            'telesaleDetails' => [],
        ]]);
    };
    if (empty($userMap)) { $emptyPayload(); exit; }

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
    if (empty($visibleIds)) { $emptyPayload(); exit; }

    // Pickers list the whole visible set, never the current filter — otherwise choosing one team
    // would delete every other option from the control that chose it.
    $teamsSeen = [];
    foreach ($visibleIds as $id) $teamsSeen[$userMap[$id]['team_key']] = $userMap[$id]['team_name'];
    $teamsList = [];
    foreach ($teamsSeen as $k => $v) $teamsList[] = ['key' => (string) $k, 'name' => $v];
    usort($teamsList, function ($x, $y) {
        if ($x['key'] === '0') return 1;
        if ($y['key'] === '0') return -1;
        return strcmp($x['name'], $y['name']);
    });
    $agentsList = [];
    foreach ($visibleIds as $id) {
        $m = $userMap[$id];
        $agentsList[] = ['id' => $id, 'name' => trim($m['first_name'] . ' ' . $m['last_name']),
                         'firstName' => $m['first_name'], 'teamKey' => $m['team_key'],
                         'roleLabel' => $m['role_label'], 'isInactive' => $m['is_inactive']];
    }
    usort($agentsList, function ($x, $y) { return strcmp($x['firstName'], $y['firstName']); });

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
    if (empty($activeIds)) {
        json_response(['success' => true, 'data' => [
            'period' => ['year' => $year, 'month' => $month],
            'teamTotals' => new stdClass(), 'telesaleCount' => 0, 'previousMonthSales' => 0,
            'ownedSource' => 'live', 'teams' => $teamsList, 'agents' => $agentsList,
            'rankings' => ['byConversion' => [], 'bySales' => [], 'byCoreRate' => [], 'byUpsell' => []],
            'telesaleDetails' => [],
        ]]);
        exit;
    }
    $idPh = implode(',', array_fill(0, count($activeIds), '?'));
    $deadPh = implode(',', array_fill(0, count(TP_DEAD_STATUSES), '?'));
    $lineAmount = "COALESCE(oi.net_total, oi.quantity * oi.price_per_unit)";
    $liveItem = "(oi.is_freebie = 0 OR oi.is_freebie IS NULL) AND oi.parent_item_id IS NULL";

    // ========================================================================
    // 1. Calls — call_date is a DATE column, so a range on it uses idx_cil_calldate_user
    // ========================================================================
    $sqlCalls = "
        SELECT matched_user_id AS user_id,
               COUNT(*) AS total_calls,
               SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) AS connected_calls,
               SUM(CASE WHEN status = 1 AND TIME_TO_SEC(duration) >= 30 THEN 1 ELSE 0 END) AS talked_call_count,
               COUNT(DISTINCT CASE WHEN rec_type = 2 AND status = 1 AND TIME_TO_SEC(duration) >= 30
                                   THEN call_termination END) AS talked_people,
               SUM(CASE WHEN status = 0 THEN 1 ELSE 0 END) AS missed_calls,
               SUM(CASE WHEN rec_type = 1 THEN 1 ELSE 0 END) AS inbound_calls,
               SUM(CASE WHEN rec_type = 2 THEN 1 ELSE 0 END) AS outbound_calls,
               ROUND(COALESCE(SUM(TIME_TO_SEC(duration)), 0) / 60, 2) AS total_minutes,
               ROUND(COALESCE(AVG(CASE WHEN TIME_TO_SEC(duration) > 0 THEN TIME_TO_SEC(duration) END), 0) / 60, 2) AS avg_duration_minutes
        FROM call_import_logs
        WHERE matched_user_id IN ($idPh) AND call_date >= ? AND call_date < ?
        GROUP BY matched_user_id
    ";
    $stmt = $pdo->prepare($sqlCalls);
    $stmt->execute(array_merge($activeIds, [$callFrom, $callToEx]));
    $callsByUser = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) $callsByUser[(int) $row['user_id']] = $row;

    // ========================================================================
    // 2. Orders & sales — one pass. Upsell (basket 51) is split out as its own figure, but the
    //    order count is DISTINCT across everything so a bill holding both is counted once.
    // ========================================================================
    $sqlOrders = "
        SELECT oi.creator_id AS user_id,
               COUNT(DISTINCT o.id) AS total_orders,
               COALESCE(SUM(CASE WHEN oi.basket_key_at_sale IS NULL OR oi.basket_key_at_sale <> 51 THEN $lineAmount ELSE 0 END), 0) AS regular_sales,
               COUNT(DISTINCT CASE WHEN oi.basket_key_at_sale = 51 THEN o.id END) AS upsell_orders,
               COALESCE(SUM(CASE WHEN oi.basket_key_at_sale = 51 THEN $lineAmount ELSE 0 END), 0) AS upsell_sales
        FROM order_items oi
        JOIN orders o ON oi.parent_order_id = o.id
          LEFT JOIN order_boxes ob ON ob.sub_order_id = oi.order_id
          WHERE oi.creator_id IN ($idPh)
          AND o.company_id = ?
          AND o.order_date >= ? AND o.order_date < ?
          AND o.order_status NOT IN ($deadPh)
            AND (ob.status IS NULL OR (ob.status != 'RETURNED' AND ob.status != 'CANCELLED'))
          AND $liveItem
        GROUP BY oi.creator_id
    ";
    $stmt = $pdo->prepare($sqlOrders);
    $stmt->execute(array_merge($activeIds, [$companyId, $dayStart, $dayEndEx], TP_DEAD_STATUSES));
    $ordersByUser = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) $ordersByUser[(int) $row['user_id']] = $row;

    // ---- Sales targets (month-level, so daily mode reads the month it sits in)
    $stmt = $pdo->prepare("SELECT user_id, target_amount FROM sales_targets WHERE month = ? AND year = ?");
    $stmt->execute([$ownMonth, $ownYear]);
    $targetsByUser = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) $targetsByUser[(int) $row['user_id']] = floatval($row['target_amount']);

    // ========================================================================
    // 3. AOV by product group. A bill carrying both groups counts in both — these are AOV
    //    denominators, never totals.
    // ========================================================================
    $sqlAov = "
        SELECT oi.creator_id AS user_id,
               COUNT(DISTINCT CASE WHEN p.category LIKE '%ปุ๋ย%' THEN o.id END) AS fert_orders,
               COALESCE(SUM(CASE WHEN p.category LIKE '%ปุ๋ย%' THEN $lineAmount ELSE 0 END), 0) AS fert_sales,
               COUNT(DISTINCT CASE WHEN p.category LIKE '%ชีวภัณฑ์%' THEN o.id END) AS bio_orders,
               COALESCE(SUM(CASE WHEN p.category LIKE '%ชีวภัณฑ์%' THEN $lineAmount ELSE 0 END), 0) AS bio_sales
        FROM order_items oi
        JOIN orders o ON oi.parent_order_id = o.id
          LEFT JOIN order_boxes ob ON ob.sub_order_id = oi.order_id
          JOIN products p ON oi.product_id = p.id
        WHERE oi.creator_id IN ($idPh)
          AND o.company_id = ?
          AND o.order_date >= ? AND o.order_date < ?
          AND o.order_status NOT IN ($deadPh)
            AND (ob.status IS NULL OR (ob.status != 'RETURNED' AND ob.status != 'CANCELLED'))
          AND $liveItem
        GROUP BY oi.creator_id
    ";
    $stmt = $pdo->prepare($sqlAov);
    $stmt->execute(array_merge($activeIds, [$companyId, $dayStart, $dayEndEx], TP_DEAD_STATUSES));
    $aovByUser = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) $aovByUser[(int) $row['user_id']] = $row;

    // ========================================================================
    // 4. Customers in hand, per tier — month-end snapshot, live only as fallback
    // ========================================================================
    $ownedSource = 'live';
    $ownedRows = [];
    if ($ownMonthStart < date('Y-m-01')) {
        $sd = $pdo->prepare("SELECT MAX(snapshot_date) FROM customer_ownership_snapshots
                             WHERE company_id = ? AND snapshot_date BETWEEN ? AND ?");
        $sd->execute([$companyId, $ownMonthStart, date('Y-m-t', strtotime($ownMonthStart))]);
        $snapDate = $sd->fetchColumn();
        if ($snapDate) {
            $sn = $pdo->prepare("SELECT agent_id AS user_id, basket_key, SUM(owned_count) AS cnt, MAX(source) AS source
                                 FROM customer_ownership_snapshots
                                 WHERE snapshot_date = ? AND company_id = ? AND agent_id IN ($idPh)
                                 GROUP BY agent_id, basket_key");
            $sn->execute(array_merge([$snapDate, $companyId], $activeIds));
            $ownedRows = $sn->fetchAll(PDO::FETCH_ASSOC);
            if (!empty($ownedRows)) {
                $ownedSource = 'snapshot';
                foreach ($ownedRows as $r) {
                    if ($r['source'] === 'backfill') { $ownedSource = 'backfill'; break; }
                }
            }
        }
    }
    if (empty($ownedRows)) {
        $lv = $pdo->prepare("SELECT assigned_to AS user_id, current_basket_key AS basket_key, COUNT(*) AS cnt
                             FROM customers WHERE company_id = ? AND assigned_to IN ($idPh)
                             GROUP BY assigned_to, current_basket_key");
        $lv->execute(array_merge([$companyId], $activeIds));
        $ownedRows = $lv->fetchAll(PDO::FETCH_ASSOC);
        $ownedSource = 'live';
    }
    $newCustCountByUser = [];
    $coreCustCountByUser = [];
    $revivalCustCountByUser = [];
    $tierOf = function ($basketKey) use ($TIER_NEW_KEYS, $TIER_CORE_KEYS, $TIER_REVIVAL_KEYS) {
        $b = (int) $basketKey;
        if (in_array($b, $TIER_NEW_KEYS, true)) return 'new';
        if (in_array($b, $TIER_CORE_KEYS, true)) return 'core';
        if (in_array($b, $TIER_REVIVAL_KEYS, true)) return 'revival';
        return null;
    };
    foreach ($ownedRows as $r) {
        $uid = (int) $r['user_id'];
        $tier = $tierOf($r['basket_key']);
        if ($tier === null) continue;
        $cnt = (int) $r['cnt'];
        if ($tier === 'new') $newCustCountByUser[$uid] = ($newCustCountByUser[$uid] ?? 0) + $cnt;
        elseif ($tier === 'core') $coreCustCountByUser[$uid] = ($coreCustCountByUser[$uid] ?? 0) + $cnt;
        else $revivalCustCountByUser[$uid] = ($revivalCustCountByUser[$uid] ?? 0) + $cnt;
    }

    // ========================================================================
    // 5. Orders & sales per tier (basket at the moment of sale)
    // ========================================================================
    $segCase = "COALESCE(oi.basket_key_at_sale, o.basket_key_at_sale)";
    $sqlSegment = "
        SELECT oi.creator_id AS user_id,
               COUNT(DISTINCT CASE WHEN $segCase IN ($newKeysIn) THEN o.id END) AS new_orders,
               COALESCE(SUM(CASE WHEN $segCase IN ($newKeysIn) THEN $lineAmount ELSE 0 END), 0) AS new_sales,
               COUNT(DISTINCT CASE WHEN $segCase IN ($coreKeysIn) THEN o.id END) AS core_orders,
               COALESCE(SUM(CASE WHEN $segCase IN ($coreKeysIn) THEN $lineAmount ELSE 0 END), 0) AS core_sales,
               COUNT(DISTINCT CASE WHEN $segCase IN ($revivalKeysIn) THEN o.id END) AS revival_orders,
               COALESCE(SUM(CASE WHEN $segCase IN ($revivalKeysIn) THEN $lineAmount ELSE 0 END), 0) AS revival_sales
        FROM order_items oi
        JOIN orders o ON oi.parent_order_id = o.id
          LEFT JOIN order_boxes ob ON ob.sub_order_id = oi.order_id
          WHERE oi.creator_id IN ($idPh)
          AND o.company_id = ?
          AND o.order_date >= ? AND o.order_date < ?
          AND o.order_status NOT IN ($deadPh)
            AND (ob.status IS NULL OR (ob.status != 'RETURNED' AND ob.status != 'CANCELLED'))
          AND $liveItem
          AND $segCase IN ($allSegmentKeysIn)
        GROUP BY oi.creator_id
    ";
    $stmt = $pdo->prepare($sqlSegment);
    $stmt->execute(array_merge($activeIds, [$companyId, $dayStart, $dayEndEx], TP_DEAD_STATUSES));
    $segByUser = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) $segByUser[(int) $row['user_id']] = $row;

    // ========================================================================
    // 6. Attendance. Days worked and minutes talked must cover the same span — capping days at
    //    yesterday while minutes included today inflated นาที/วัน for the whole current month.
    // ========================================================================
    //    ดึงรายวันเพื่อคิด "วันทำงาน" ตามกติกา KPI (เสาร์-อาทิตย์ role 6/7 ฐาน 6 ชม.
    //    ดู attendance_kpi.php) ให้ตรงกับแท็บรายวัน (telesale_daily_performance.php)
    //    เดิม SUM ดิบทำให้คนมาวันเสาร์ได้ 0.75 วันแล้วสรุปเดือนไม่ตรงกับแท็บรายวัน
    if ($isDaily) {
        $attWindow = [$specificDate, date('Y-m-d', strtotime($specificDate . ' +1 day'))];
    } else {
        $attWindow = [$ownMonthStart, date('Y-m-d', strtotime($ownMonthStart . ' +1 month'))];
    }
    $attSql = "SELECT user_id, work_date, COALESCE(SUM(attendance_value), 0) AS att_value
               FROM user_daily_attendance
               WHERE work_date >= ? AND work_date < ? AND user_id IN ($idPh)
               GROUP BY user_id, work_date";
    $stmt = $pdo->prepare($attSql);
    $stmt->execute(array_merge($attWindow, $activeIds));
    $attendByUser = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $uid = (int) $row['user_id'];
        $roleId = (int) ($userMap[$uid]['role_id'] ?? 0);
        $attendByUser[$uid] = ($attendByUser[$uid] ?? 0)
            + kpi_working_day_fraction($row['att_value'], $row['work_date'], $roleId);
    }

    // ========================================================================
    // 7. Returned bills — excluded from sales above, reported on their own so the loss stays visible
    // ========================================================================
    $sqlReturned = "
        SELECT oi.creator_id AS user_id,
               COUNT(DISTINCT o.id) AS returned_orders,
               COALESCE(SUM($lineAmount), 0) AS returned_sales
        FROM order_items oi
        JOIN orders o ON oi.parent_order_id = o.id
          LEFT JOIN order_boxes ob ON ob.sub_order_id = oi.order_id LEFT JOIN order_boxes ob ON ob.sub_order_id = oi.order_id
        WHERE oi.creator_id IN ($idPh)
          AND o.company_id = ?
          AND o.order_date >= ? AND o.order_date < ?
          AND (o.order_status = 'Returned' OR ob.status = 'RETURNED' OR ob.status = 'CANCELLED')
          AND $liveItem
        GROUP BY oi.creator_id
    ";
    $stmt = $pdo->prepare($sqlReturned);
    $stmt->execute(array_merge($activeIds, [$companyId, $dayStart, $dayEndEx]));
    $returnedByUser = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) $returnedByUser[(int) $row['user_id']] = $row;

    // ========================================================================
    // 8. Combine
    // ========================================================================
    $telesaleDetails = [];
    foreach ($activeIds as $userId) {
        $meta = $userMap[$userId];
        $call = $callsByUser[$userId] ?? null;
        $ord = $ordersByUser[$userId] ?? null;
        $ret = $returnedByUser[$userId] ?? null;
        $aov = $aovByUser[$userId] ?? null;
        $seg = $segByUser[$userId] ?? null;

        $totalCalls = $call ? (int) $call['total_calls'] : 0;
        $connectedCalls = $call ? (int) $call['connected_calls'] : 0;
        // ได้คุย is a head count, not a call count: ringing the same customer four times and getting
        // through each time is one person reached. As a call count it could exceed the size of the
        // book it was dialled from, which reads as a broken number to anyone looking at the row.
        $talkedCalls = $call ? (int) $call['talked_people'] : 0;
        $talkedCallCount = $call ? (int) $call['talked_call_count'] : 0;
        $missedCalls = $call ? (int) $call['missed_calls'] : 0;
        $inboundCalls = $call ? (int) $call['inbound_calls'] : 0;
        $outboundCalls = $call ? (int) $call['outbound_calls'] : 0;
        $totalMinutes = $call ? (float) $call['total_minutes'] : 0.0;
        $avgMinutesPerCall = $call ? (float) $call['avg_duration_minutes'] : 0.0;
        $answerRate = $totalCalls > 0 ? round(($connectedCalls / $totalCalls) * 100, 1) : 0;

        $allOrders = $ord ? (int) $ord['total_orders'] : 0;
        $regularSales = $ord ? (float) $ord['regular_sales'] : 0.0;
        $upsellOrders = $ord ? (int) $ord['upsell_orders'] : 0;
        $upsellSales = $ord ? (float) $ord['upsell_sales'] : 0.0;
        $combinedSales = $regularSales + $upsellSales;

        $returnedOrders = $ret ? (int) $ret['returned_orders'] : 0;
        $returnedSales = $ret ? (float) $ret['returned_sales'] : 0.0;

        // One close-rate definition for the whole page: ออเดอร์ ÷ ได้คุย
        $conversionRate = $talkedCalls > 0 ? round(($allOrders / $talkedCalls) * 100, 2) : 0;

        $fertOrders = $aov ? (int) $aov['fert_orders'] : 0;
        $bioOrders = $aov ? (int) $aov['bio_orders'] : 0;
        $aovFertilizer = $fertOrders > 0 ? round(((float) $aov['fert_sales']) / $fertOrders, 0) : 0;
        $aovBio = $bioOrders > 0 ? round(((float) $aov['bio_sales']) / $bioOrders, 0) : 0;

        $newCustCount = $newCustCountByUser[$userId] ?? 0;
        $coreCustCount = $coreCustCountByUser[$userId] ?? 0;
        $revivalCustCount = $revivalCustCountByUser[$userId] ?? 0;
        $newCustOrders = $seg ? (int) $seg['new_orders'] : 0;
        $coreCustOrders = $seg ? (int) $seg['core_orders'] : 0;
        $revivalCustOrders = $seg ? (int) $seg['revival_orders'] : 0;
        $newCustSales = $seg ? (float) $seg['new_sales'] : 0.0;
        $coreCustSales = $seg ? (float) $seg['core_sales'] : 0.0;
        $revivalCustSales = $seg ? (float) $seg['revival_sales'] : 0.0;

        $workingDays = $attendByUser[$userId] ?? 0;
        $avgMinutesPerDay = $workingDays > 0 ? round($totalMinutes / $workingDays, 1) : 0;

        $targetAmount = $targetsByUser[$userId] ?? 0;
        $targetProgress = $targetAmount > 0 ? round(($combinedSales / $targetAmount) * 100, 1) : 0;

        // Drop agents with nothing at all in the period — an all-zero row is noise, not a finding.
        if ($totalCalls === 0 && $allOrders === 0 && $newCustCount === 0 && $coreCustCount === 0
            && $revivalCustCount === 0 && $workingDays == 0 && $returnedOrders === 0) {
            continue;
        }

        $telesaleDetails[] = [
            'userId' => $userId,
            'name' => trim($meta['first_name'] . ' ' . $meta['last_name']),
            'firstName' => $meta['first_name'],
            'phone' => $meta['phone'],
            'teamKey' => $meta['team_key'],
            'teamName' => $meta['team_name'],
            'roleLabel' => $meta['role_label'],
            'isInactive' => $meta['is_inactive'],
            'hasBook' => $meta['has_book'],
            'metrics' => [
                'totalOrders' => $allOrders,
                'conversionRate' => $conversionRate,
                'totalSales' => $regularSales,
                'upsellOrders' => $upsellOrders,
                'upsellSales' => $upsellSales,
                'combinedSales' => $combinedSales,
                'customers90Days' => $coreCustCount,
                'aovFertilizer' => $aovFertilizer,
                'aovBio' => $aovBio,
                'newCustCount' => $newCustCount,
                'newCustOrders' => $newCustOrders,
                'newCustSales' => $newCustSales,
                'newCustRate' => $newCustCount > 0 ? round(($newCustOrders / $newCustCount) * 100, 1) : 0,
                'coreCustCount' => $coreCustCount,
                'coreCustOrders' => $coreCustOrders,
                'coreCustSales' => $coreCustSales,
                'coreCustRate' => $coreCustCount > 0 ? round(($coreCustOrders / $coreCustCount) * 100, 1) : 0,
                'revivalCustCount' => $revivalCustCount,
                'revivalCustOrders' => $revivalCustOrders,
                'revivalCustSales' => $revivalCustSales,
                'revivalCustRate' => $revivalCustCount > 0 ? round(($revivalCustOrders / $revivalCustCount) * 100, 1) : 0,
                'returnedOrders' => $returnedOrders,
                'returnedSales' => $returnedSales,
                'targetAmount' => $targetAmount,
                'targetProgress' => $targetProgress,
                'totalCalls' => $totalCalls,
                'connectedCalls' => $connectedCalls,
                'talkedCalls' => $talkedCalls,
                'talkedCallCount' => $talkedCallCount,
                'answeredCalls' => $connectedCalls,
                'missedCalls' => $missedCalls,
                'inboundCalls' => $inboundCalls,
                'outboundCalls' => $outboundCalls,
                'answerRate' => $answerRate,
                'totalMinutes' => round($totalMinutes, 1),
                'avgMinutesPerCall' => $avgMinutesPerCall,
                'workingDays' => $workingDays,
                'avgMinutesPerDay' => $avgMinutesPerDay,
            ],
        ];
    }

    // ========================================================================
    // 9. Team totals
    // ========================================================================
    $teamTotals = [
        'totalOrders' => 0, 'totalSales' => 0, 'upsellSales' => 0, 'combinedSales' => 0,
        'totalCalls' => 0, 'connectedCalls' => 0, 'talkedCalls' => 0, 'answeredCalls' => 0,
        'missedCalls' => 0, 'inboundCalls' => 0, 'totalMinutes' => 0,
        'newCustCount' => 0, 'coreCustCount' => 0, 'revivalCustCount' => 0,
        'newCustOrders' => 0, 'coreCustOrders' => 0, 'revivalCustOrders' => 0,
        'newCustSales' => 0, 'coreCustSales' => 0, 'revivalCustSales' => 0,
        'returnedOrders' => 0, 'returnedSales' => 0, 'conversionRate' => 0,
    ];
    foreach ($telesaleDetails as $ts) {
        $m = $ts['metrics'];
        foreach (['totalOrders', 'totalCalls', 'connectedCalls', 'talkedCalls', 'missedCalls', 'inboundCalls',
                  'newCustCount', 'coreCustCount', 'revivalCustCount', 'newCustOrders', 'coreCustOrders',
                  'revivalCustOrders', 'returnedOrders'] as $f) {
            $teamTotals[$f] += $m[$f];
        }
        foreach (['totalSales', 'upsellSales', 'combinedSales', 'totalMinutes',
                  'newCustSales', 'coreCustSales', 'revivalCustSales', 'returnedSales'] as $f) {
            $teamTotals[$f] += $m[$f];
        }
        $teamTotals['answeredCalls'] += $m['connectedCalls'];
    }
    // Same formula as the per-agent rows
    $teamTotals['conversionRate'] = $teamTotals['talkedCalls'] > 0
        ? round(($teamTotals['totalOrders'] / $teamTotals['talkedCalls']) * 100, 2)
        : 0;

    // ========================================================================
    // 10. Previous month, same scope and same sales rule
    // ========================================================================
    $prevStart = date('Y-m-d 00:00:00', strtotime($ownMonthStart . ' -1 month'));
    $prevEndEx = $ownMonthStart . ' 00:00:00';
    $sqlPrev = "
        SELECT COALESCE(SUM($lineAmount), 0) AS prev_sales
        FROM order_items oi
        JOIN orders o ON oi.parent_order_id = o.id
          LEFT JOIN order_boxes ob ON ob.sub_order_id = oi.order_id
          WHERE oi.creator_id IN ($idPh)
          AND o.company_id = ?
          AND o.order_date >= ? AND o.order_date < ?
          AND o.order_status NOT IN ($deadPh)
            AND (ob.status IS NULL OR (ob.status != 'RETURNED' AND ob.status != 'CANCELLED'))
          AND $liveItem
    ";
    $stmt = $pdo->prepare($sqlPrev);
    $stmt->execute(array_merge($activeIds, [$companyId, $prevStart, $prevEndEx], TP_DEAD_STATUSES));
    $previousMonthSales = floatval($stmt->fetchColumn());

    // ========================================================================
    // 11. Rankings
    // ========================================================================
    $topBy = function ($field, $map, $filterPositive = false) use ($telesaleDetails) {
        $list = $telesaleDetails;
        if ($filterPositive) {
            $list = array_values(array_filter($list, function ($ts) use ($field) { return $ts['metrics'][$field] > 0; }));
        }
        usort($list, function ($a, $b) use ($field) { return $b['metrics'][$field] <=> $a['metrics'][$field]; });
        return array_map($map, array_slice($list, 0, 10));
    };
    $rankingsConversion = $topBy('conversionRate', function ($ts) {
        return ['userId' => $ts['userId'], 'name' => $ts['name'], 'value' => $ts['metrics']['conversionRate'],
                'calls' => $ts['metrics']['talkedCalls'], 'orders' => $ts['metrics']['totalOrders']];
    });
    $rankingsSales = $topBy('combinedSales', function ($ts) {
        return ['userId' => $ts['userId'], 'name' => $ts['name'], 'value' => $ts['metrics']['combinedSales'],
                'upsell' => $ts['metrics']['upsellSales']];
    });
    $rankingsCoreRate = $topBy('coreCustRate', function ($ts) {
        return ['userId' => $ts['userId'], 'name' => $ts['name'], 'value' => $ts['metrics']['coreCustRate'],
                'orders' => $ts['metrics']['coreCustOrders'], 'count' => $ts['metrics']['coreCustCount']];
    });
    $rankingsUpsell = $topBy('upsellSales', function ($ts) {
        return ['userId' => $ts['userId'], 'name' => $ts['name'], 'value' => $ts['metrics']['upsellSales'],
                'orders' => $ts['metrics']['upsellOrders']];
    }, true);

    json_response([
        'success' => true,
        'data' => [
            'period' => ['year' => $year, 'month' => $month],
            'teamTotals' => $teamTotals,
            'telesaleCount' => count($telesaleDetails),
            'previousMonthSales' => $previousMonthSales,
            'ownedSource' => $ownedSource,
            'teams' => $teamsList,
            'agents' => $agentsList,
            'rankings' => [
                'byConversion' => $rankingsConversion,
                'bySales' => $rankingsSales,
                'byCoreRate' => $rankingsCoreRate,
                'byUpsell' => $rankingsUpsell,
            ],
            'telesaleDetails' => $telesaleDetails,
        ],
    ]);

} catch (Exception $e) {
    error_log('Telesale Performance API Error: ' . $e->getMessage());
    json_response(['success' => false, 'message' => 'Server error: ' . $e->getMessage()], 500);
}
