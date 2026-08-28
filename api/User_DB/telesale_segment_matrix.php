<?php
/**
 * Telesale Segment Matrix API — agent (row) × basket segment (column), one month.
 *
 * Answers "ถังไหนของใครเดินอยู่" in one grid: for every telesale/admin-page agent, and every
 * dashboard basket, how big the book was, how much of it got dialled, and what came out of it.
 *
 * Metric definitions are deliberately IDENTICAL to Reports/telesale_campaign_compare.php so the
 * two screens can never disagree:
 *
 *   owned         ลูกค้าที่ดูแล  — customers in hand at the END of that month, read from
 *                 customer_ownership_snapshots (month-end row written by cron/snapshot_customer_
 *                 ownership.php at 23:50, before the day-1 01:00 reclaim). A month that has not
 *                 ended yet — or has no snapshot row — falls back to the live `customers` table
 *                 and says so via owned_source, because the live figure is always POST-reclaim
 *                 and therefore smaller than the book the agent actually worked.
 *   names_called  ชื่อที่โทร     — distinct customer phone dialled that month (outbound only)
 *   total_calls   สายที่โทร      — every outbound attempt, same phone counted again
 *   talked        ได้คุย         — distinct customer phone that answered and stayed on for >= 30s
 *                 (the system-wide "ได้คุย" rule). Counted per PERSON, not per call: as a call
 *                 count it could exceed the size of the book it was dialled from, which reads as
 *                 a bug even though ringing the same customer four times is normal.
 *   orders/sales  ออเดอร์/ยอดขาย — from order_items, net of freebies and dead statuses
 *
 * Which basket a row lands in:
 *   - owned : the basket recorded in the snapshot itself
 *   - calls : the basket the DIALLED CUSTOMER sat in at that same month-end
 *             (customer_basket_snapshots, live fallback), matched by phone (66XXXXXXXXX -> 0XXX)
 *   - sales : order_items.basket_key_at_sale — the basket at the moment of sale
 *   One snapshot date drives owned AND calls, so a segment can never show "19 owned / 100 called"
 *   built from two different points in time.
 *
 * Segments are FIXED-ORDER by design (see $SEGMENT_SPEC) because the screen is read left-to-right
 * as a customer-age journey. Any other active dashboard_v2 basket is appended automatically, so a
 * basket added in basket_config can never silently vanish from the report the way 6-9m/9-12m
 * (58/59) did when they were split out of 6-12m (48) in May 2026.
 *
 * Params: year, month, roles (csv of telesale|adminpage, default telesale),
 *         teams (csv of team keys: supervisor id | admin_page | 0), agents (csv of user ids),
 *         inactive=1 (include people who have left)
 */

require_once __DIR__ . '/../config.php';

cors();

/** Sales rows that count. Returned bills are excluded here — a bill that came back is not revenue,
 *  and the monthly table next to this one now applies the same rule. */
const SEG_DEAD_STATUSES = ['Cancelled', 'BadDebt', 'Returned'];

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
    $isAdmin = (strpos($role, 'admin') !== false && !$isSupervisor && strpos($role, 'admin page') === false) || strpos($role, 'super admin') !== false;
    $isCEO = strpos($role, 'ceo') !== false;

    $year = isset($_GET['year']) ? intval($_GET['year']) : intval(date('Y'));
    $month = isset($_GET['month']) ? intval($_GET['month']) : intval(date('m'));
    if ($month < 1 || $month > 12 || $year < 2000) {
        json_response(['success' => false, 'message' => 'Invalid period'], 400);
        exit;
    }

    $monthStart = sprintf('%04d-%02d-01', $year, $month);
    $rangeStart = $monthStart . ' 00:00:00';
    $rangeEnd = date('Y-m-d 00:00:00', strtotime($monthStart . ' +1 month'));

    // ---- CSV params -------------------------------------------------------
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
    if (empty($wantRoles)) $wantRoles = ['telesale'];          // telesale-first: admin page is opt-in
    $wantTelesale = in_array('telesale', $wantRoles, true);
    $wantAdminPage = in_array('adminpage', $wantRoles, true);
    $filterTeams = $csv('teams');
    $filterAgents = array_values(array_filter(array_map('intval', $csv('agents')), function ($n) { return $n > 0; }));
    // People who have left are hidden by default — their book was reclaimed, so every column but
    // sales reads as a row of dashes. `inactive=1` brings them back for the months they did work.
    $showInactive = isset($_GET['inactive']) && $_GET['inactive'] === '1';

    $roleIds = [];
    if ($wantTelesale) { $roleIds[] = 6; $roleIds[] = 7; }
    if ($wantAdminPage) { $roleIds[] = 3; }
    if (empty($roleIds)) $roleIds = [6, 7];

    // ---- Segment definition ----------------------------------------------
    // basket id => label, straight from basket_config so a rename in settings follows through.
    $basketName = [];
    $bc = $pdo->prepare("SELECT id, basket_name, is_active FROM basket_config WHERE target_page = 'dashboard_v2' AND company_id = ?");
    $bc->execute([$companyId]);
    $activeDashBaskets = [];
    foreach ($bc->fetchAll(PDO::FETCH_ASSOC) as $b) {
        $basketName[(int) $b['id']] = $b['basket_name'];
        if ((int) $b['is_active'] === 1) $activeDashBaskets[] = (int) $b['id'];
    }
    $nameOf = function ($id, $fallback) use ($basketName) {
        return isset($basketName[$id]) && $basketName[$id] !== '' ? $basketName[$id] : $fallback;
    };

    $SEGMENT_SPEC = [
        ['key' => 'new',      'baskets' => [38],     'label' => $nameOf(38, 'ลูกค้าใหม่')],
        ['key' => 'waiting',  'baskets' => [47],     'label' => $nameOf(47, 'รอคนมาจีบให้ติด')],
        ['key' => 'newowner', 'baskets' => [46],     'label' => $nameOf(46, 'หาคนดูแลใหม่')],
        ['key' => 'personal', 'baskets' => [39, 40], 'label' => 'ส่วนตัว 1-2 ด. + โอกาสสุดท้าย',
         'tip' => 'รวม 2 ถัง: ' . $nameOf(39, 'ส่วนตัว 1-2 เดือน') . ' + ' . $nameOf(40, 'ส่วนตัวโอกาสสุดท้าย')],
        ['key' => 'mid_6_9',  'baskets' => [58],     'label' => $nameOf(58, 'ถังกลาง 6-9 เดือน')],
        ['key' => 'mid_9_12', 'baskets' => [59],     'label' => $nameOf(59, 'ถังกลาง 9-12 เดือน')],
        ['key' => 'mid_1_3y', 'baskets' => [49],     'label' => $nameOf(49, 'ถังกลาง 1-3 ปี')],
        ['key' => 'ancient',  'baskets' => [50],     'label' => $nameOf(50, 'ถังโบราณ เก่าเก็บ')],
    ];
    // Any other active dashboard basket (Upsell, Marketplace, whatever settings adds next) gets its
    // own trailing column instead of disappearing into thin air.
    $claimed = [];
    foreach ($SEGMENT_SPEC as $s) foreach ($s['baskets'] as $b) $claimed[$b] = true;
    sort($activeDashBaskets);
    foreach ($activeDashBaskets as $bid) {
        if (isset($claimed[$bid])) continue;
        $SEGMENT_SPEC[] = ['key' => 'b' . $bid, 'baskets' => [$bid], 'label' => $nameOf($bid, 'ถัง #' . $bid), 'auto' => true];
        $claimed[$bid] = true;
    }
    // Not a basket — the residue. In practice it is dominated by calls the agent DID make that
    // month to customers who, by month-end, had already fallen out of their hands and back into
    // the distribution pool (Jul 2026: 11,182 of 12,091 names). The rest are numbers that match no
    // customer at all. Both are worth seeing: it was ~35% of the month's dialling effort.
    $OTHER_KEY = 'other';
    $SEGMENT_SPEC[] = ['key' => $OTHER_KEY, 'baskets' => [], 'label' => 'หลุดมือ / นอกถัง', 'auto' => true,
                       'tip' => 'ไม่ใช่ถังจริง แต่เป็นเศษที่เหลือ — ส่วนใหญ่คือลูกค้าที่โทรหาไปแล้วในเดือนนั้น '
                              . 'แต่พอถึงสิ้นเดือนหลุดจากมือกลับเข้าถังฝั่งแจกแล้ว (ก.ค. 2026 = 11,182 จาก 12,091 ชื่อ) '
                              . 'ที่เหลือคือเบอร์ที่จับคู่กับลูกค้าในระบบไม่ได้เลย'];

    $segOfBasket = [];   // basket id => segment key
    foreach ($SEGMENT_SPEC as $s) foreach ($s['baskets'] as $b) $segOfBasket[$b] = $s['key'];
    $segKeyOf = function ($basketId) use ($segOfBasket, $OTHER_KEY) {
        if ($basketId === null || $basketId === '') return $OTHER_KEY;
        $bid = (int) $basketId;
        return isset($segOfBasket[$bid]) ? $segOfBasket[$bid] : $OTHER_KEY;
    };

    // ---- Users, teams, scope ---------------------------------------------
    // No `teams` table: a team is its role-6 supervisor. Members link by supervisor_id, or by
    // team_id matched to a supervisor's team_id. Admin Page (role 3) is its own pseudo-team.
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

    $ADMIN_TEAM_KEY = 'admin_page';
    $NO_TEAM = 'ไม่มีทีม';
    $resolveTeam = function ($u) use ($supById, $teamIdToSup, $ADMIN_TEAM_KEY, $NO_TEAM) {
        $rid = (int) $u['role_id'];
        if ($rid === 3) return ['key' => $ADMIN_TEAM_KEY, 'name' => 'Admin Page'];
        if ($rid === 6) return ['key' => (string) (int) $u['id'], 'name' => $u['first_name'] ?: ('#' . $u['id'])];
        $sid = $u['supervisor_id'] !== null ? (int) $u['supervisor_id'] : 0;
        if ($sid && isset($supById[$sid])) return ['key' => (string) $sid, 'name' => $supById[$sid]];
        $tid = $u['team_id'] !== null ? (int) $u['team_id'] : 0;
        if ($tid && isset($teamIdToSup[$tid])) {
            $h = $teamIdToSup[$tid];
            return ['key' => (string) $h, 'name' => $supById[$h]];
        }
        return ['key' => '0', 'name' => $NO_TEAM];
    };

    $rolePh = implode(',', array_fill(0, count($roleIds), '?'));
    $uStmt = $pdo->prepare("SELECT id, first_name, last_name, role, role_id, team_id, supervisor_id, status
                            FROM users WHERE role_id IN ($rolePh) AND company_id = ?");
    $uStmt->execute(array_merge($roleIds, [$companyId]));

    $userMap = [];
    foreach ($uStmt->fetchAll(PDO::FETCH_ASSOC) as $u) {
        $id = (int) $u['id'];
        $rid = (int) $u['role_id'];
        $roleLabel = $rid === 6 ? 'Sup' : ($rid === 3 ? 'Admin Page' : 'Telesale');
        $t = $resolveTeam($u);
        $userMap[$id] = [
            'id' => $id,
            'name' => trim(($u['first_name'] ?? '') . ' ' . ($u['last_name'] ?? '')) ?: ('#' . $id),
            'first_name' => $u['first_name'] ?: ('#' . $id),
            'role_id' => $rid,
            'role_label' => $roleLabel,
            'team_key' => $t['key'],
            'team_name' => $t['name'],
            'is_inactive' => strtolower((string) $u['status']) !== 'active',
            // Admin Page owns no customers and never dials through the CDR — the UI dims those
            // columns instead of showing a wall of honest-but-meaningless zeros.
            'has_book' => $rid !== 3,
        ];
    }

    $emptyResponse = function ($segments, $teams, $agents) use ($year, $month) {
        json_response([
            'success' => true,
            'period' => ['year' => $year, 'month' => $month],
            'owned_source' => 'live',
            'snapshot_date' => null,
            'segments' => $segments,
            'teams' => $teams,
            'agents' => $agents,
            'rows' => [],
            'totals' => new stdClass(),
        ]);
    };

    // The eight journey segments are always columns, even at zero — their absence is itself the
    // finding. Everything appended automatically (Upsell, Marketplace, the challenge baskets added
    // in Aug 2026, ไม่ระบุถัง) only earns a column when it actually carries something this month,
    // otherwise the grid runs to 120+ columns of dots.
    $segmentsFor = function ($totals) use ($SEGMENT_SPEC) {
        $out = [];
        foreach ($SEGMENT_SPEC as $s) {
            $isAuto = isset($s['auto']) && $s['auto'];
            if ($isAuto) {
                $t = isset($totals[$s['key']]) ? $totals[$s['key']] : null;
                $hasData = $t && ($t['owned'] > 0 || $t['total_calls'] > 0 || $t['orders'] > 0 || $t['sales'] > 0);
                if (!$hasData) continue;
            }
            $out[] = [
                'key' => $s['key'],
                'label' => $s['label'],
                'tip' => isset($s['tip']) ? $s['tip'] : null,
                'auto' => $isAuto,
            ];
        }
        return $out;
    };
    $segmentsOut = $segmentsFor([]);

    if (empty($userMap)) { $emptyResponse($segmentsOut, [], []); exit; }

    // Viewer scope
    if ($isAdmin || $isCEO) {
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
    if (empty($visibleIds)) { $emptyResponse($segmentsOut, [], []); exit; }

    // Dropdown lists reflect the full visible set, never the current filter — otherwise picking
    // one team would erase every other option from the picker that set it.
    $teamsOut = [];
    foreach ($visibleIds as $id) $teamsOut[$userMap[$id]['team_key']] = $userMap[$id]['team_name'];
    $teamsList = [];
    foreach ($teamsOut as $k => $v) $teamsList[] = ['key' => (string) $k, 'name' => $v];
    usort($teamsList, function ($x, $y) {
        if ($x['key'] === '0') return 1;
        if ($y['key'] === '0') return -1;
        return strcmp($x['name'], $y['name']);
    });
    $agentsList = [];
    foreach ($visibleIds as $id) {
        $m = $userMap[$id];
        $agentsList[] = ['id' => $id, 'name' => $m['name'], 'firstName' => $m['first_name'],
                         'teamKey' => $m['team_key'], 'roleLabel' => $m['role_label'], 'isInactive' => $m['is_inactive']];
    }
    usort($agentsList, function ($x, $y) { return strcmp($x['firstName'], $y['firstName']); });

    // Apply team / agent filters inside the visible set
    $activeIds = $visibleIds;
    if (!empty($filterTeams)) {
        $teamSet = array_flip(array_map('strval', $filterTeams));
        $activeIds = array_values(array_filter($activeIds, function ($id) use ($userMap, $teamSet) {
            return isset($teamSet[$userMap[$id]['team_key']]);
        }));
    }
    if (!empty($filterAgents)) {
        $agentSet = array_flip($filterAgents);
        $activeIds = array_values(array_filter($activeIds, function ($id) use ($agentSet) {
            return isset($agentSet[$id]);
        }));
    }
    if (empty($activeIds)) { $emptyResponse($segmentsOut, $teamsList, $agentsList); exit; }
    $idPh = implode(',', array_fill(0, count($activeIds), '?'));

    // ---- Which snapshot date represents this month ------------------------
    $currentMonthStart = date('Y-m-01');
    $snapDate = null;
    if ($monthStart < $currentMonthStart) {
        $sd = $pdo->prepare("SELECT MAX(snapshot_date) FROM customer_basket_snapshots
                             WHERE company_id = ? AND snapshot_date BETWEEN ? AND ?");
        $sd->execute([$companyId, $monthStart, date('Y-m-t', strtotime($monthStart))]);
        $d = $sd->fetchColumn();
        if ($d) $snapDate = $d;
    }

    // ---- Accumulator ------------------------------------------------------
    $emptyCell = function () {
        return ['owned' => 0, 'names_called' => 0, 'total_calls' => 0, 'talked' => 0, 'orders' => 0, 'sales' => 0.0];
    };
    $cells = [];   // agent id => segment key => cell
    $touch = function ($aid, $seg) use (&$cells, $emptyCell) {
        if (!isset($cells[$aid])) $cells[$aid] = [];
        if (!isset($cells[$aid][$seg])) $cells[$aid][$seg] = $emptyCell();
    };

    // ---- owned ------------------------------------------------------------
    $ownedSource = 'live';
    $ownedRows = [];
    if ($snapDate !== null) {
        $sn = $pdo->prepare("SELECT agent_id, basket_key AS basket_id, SUM(owned_count) AS cnt, MAX(source) AS source
                             FROM customer_ownership_snapshots
                             WHERE snapshot_date = ? AND company_id = ? AND agent_id IN ($idPh)
                             GROUP BY agent_id, basket_key");
        $sn->execute(array_merge([$snapDate, $companyId], $activeIds));
        $ownedRows = $sn->fetchAll(PDO::FETCH_ASSOC);
        if (!empty($ownedRows)) {
            $isBackfill = false;
            foreach ($ownedRows as $r) {
                if ($r['source'] === 'backfill') { $isBackfill = true; break; }
            }
            $ownedSource = $isBackfill ? 'backfill' : 'snapshot';
        }
    }
    if (empty($ownedRows)) {
        $lv = $pdo->prepare("SELECT assigned_to AS agent_id, current_basket_key AS basket_id, COUNT(*) AS cnt
                             FROM customers WHERE company_id = ? AND assigned_to IN ($idPh)
                             GROUP BY assigned_to, current_basket_key");
        $lv->execute(array_merge([$companyId], $activeIds));
        $ownedRows = $lv->fetchAll(PDO::FETCH_ASSOC);
        $ownedSource = 'live';
    }
    foreach ($ownedRows as $r) {
        $aid = (int) $r['agent_id'];
        if (!isset($userMap[$aid])) continue;
        $seg = $segKeyOf($r['basket_id']);
        $touch($aid, $seg);
        $cells[$aid][$seg]['owned'] += (int) $r['cnt'];
    }

    // ---- phone -> basket map, matching the snapshot the owned figure came from
    $phoneBasket = [];
    if ($snapDate !== null) {
        $st = $pdo->prepare("SELECT c.phone, s.basket_key
                             FROM customer_basket_snapshots s
                             JOIN customers c ON c.customer_id = s.customer_id
                             WHERE s.snapshot_date = ? AND s.company_id = ? AND c.phone IS NOT NULL AND c.phone <> ''");
        $st->execute([$snapDate, $companyId]);
    } else {
        $st = $pdo->prepare("SELECT phone, current_basket_key AS basket_key FROM customers
                             WHERE company_id = ? AND phone IS NOT NULL AND phone <> ''");
        $st->execute([$companyId]);
    }
    while ($row = $st->fetch(PDO::FETCH_ASSOC)) $phoneBasket[$row['phone']] = $row['basket_key'];

    // ---- calls ------------------------------------------------------------
    // Outbound only. call_date is a DATE column (time of day lives in start_time), so a plain
    // range on it is both correct and index-friendly (idx_cil_calldate_user).
    $cs = $pdo->prepare("
        SELECT matched_user_id AS agent_id, call_termination AS dialed,
               COUNT(*) AS total_calls,
               SUM(CASE WHEN status = 1 AND TIME_TO_SEC(duration) >= 30 THEN 1 ELSE 0 END) AS talked
        FROM call_import_logs
        WHERE rec_type = 2 AND matched_user_id IN ($idPh)
          AND call_date >= ? AND call_date < ?
        GROUP BY matched_user_id, call_termination
    ");
    $cs->execute(array_merge($activeIds, [$monthStart, date('Y-m-d', strtotime($monthStart . ' +1 month'))]));
    while ($r = $cs->fetch(PDO::FETCH_ASSOC)) {
        $aid = (int) $r['agent_id'];
        if (!isset($userMap[$aid])) continue;
        $p = trim((string) $r['dialed']);
        if (strncmp($p, '66', 2) === 0) $p = '0' . substr($p, 2);
        $seg = $segKeyOf(isset($phoneBasket[$p]) ? $phoneBasket[$p] : null);
        $touch($aid, $seg);
        $cells[$aid][$seg]['names_called'] += 1;          // one row per distinct dialled number
        $cells[$aid][$seg]['total_calls'] += (int) $r['total_calls'];
        // Same row = same customer, so any qualifying call makes this ONE person talked to.
        if ((int) $r['talked'] > 0) $cells[$aid][$seg]['talked'] += 1;
    }

    // ---- sales ------------------------------------------------------------
    $deadPh = implode(',', array_fill(0, count(SEG_DEAD_STATUSES), '?'));
    $ss = $pdo->prepare("
        SELECT oi.creator_id AS agent_id, oi.basket_key_at_sale AS basket_id,
               COUNT(DISTINCT o.id) AS orders,
               COALESCE(SUM(COALESCE(oi.net_total, oi.quantity * oi.price_per_unit)), 0) AS sales
        FROM order_items oi
        JOIN orders o ON oi.parent_order_id = o.id
        WHERE oi.creator_id IN ($idPh)
          AND o.company_id = ?
          AND o.order_date >= ? AND o.order_date < ?
          AND o.order_status NOT IN ($deadPh)
          AND (oi.is_freebie = 0 OR oi.is_freebie IS NULL)
          AND oi.parent_item_id IS NULL
        GROUP BY oi.creator_id, oi.basket_key_at_sale
    ");
    $ss->execute(array_merge($activeIds, [$companyId, $rangeStart, $rangeEnd], SEG_DEAD_STATUSES));
    while ($r = $ss->fetch(PDO::FETCH_ASSOC)) {
        $aid = (int) $r['agent_id'];
        if (!isset($userMap[$aid])) continue;
        $seg = $segKeyOf($r['basket_id']);
        $touch($aid, $seg);
        $cells[$aid][$seg]['orders'] += (int) $r['orders'];
        $cells[$aid][$seg]['sales'] += (float) $r['sales'];
    }

    // ---- assemble ---------------------------------------------------------
    $addInto = function (&$dst, $src) {
        foreach (['owned', 'names_called', 'total_calls', 'talked', 'orders'] as $f) $dst[$f] += $src[$f];
        $dst['sales'] += $src['sales'];
    };
    $segTotals = [];
    foreach ($SEGMENT_SPEC as $s) $segTotals[$s['key']] = $emptyCell();
    $grand = $emptyCell();

    // First pass: totals per segment, so the column list below knows what actually has data.
    foreach ($activeIds as $aid) {
        $agentCells = isset($cells[$aid]) ? $cells[$aid] : [];
        foreach ($SEGMENT_SPEC as $s) {
            if (isset($agentCells[$s['key']])) $addInto($segTotals[$s['key']], $agentCells[$s['key']]);
        }
    }
    $segmentsOut = $segmentsFor($segTotals);
    $shownKeys = [];
    foreach ($segmentsOut as $s) $shownKeys[] = $s['key'];

    $rows = [];
    foreach ($activeIds as $aid) {
        $m = $userMap[$aid];
        $agentCells = isset($cells[$aid]) ? $cells[$aid] : [];
        $rowTotal = $emptyCell();
        $out = [];
        // The row total spans EVERY segment, shown or not, so "รวมทุกถัง" always ties out to the
        // agent's real month even when a hidden basket carried part of it.
        foreach ($SEGMENT_SPEC as $s) {
            $c = isset($agentCells[$s['key']]) ? $agentCells[$s['key']] : $emptyCell();
            $addInto($rowTotal, $c);
            if (in_array($s['key'], $shownKeys, true)) $out[$s['key']] = $c;
        }
        // An agent with no book, no call and no sale this month is noise, not a data point.
        if ($rowTotal['owned'] === 0 && $rowTotal['total_calls'] === 0 && $rowTotal['orders'] === 0) continue;
        $addInto($grand, $rowTotal);
        $rows[] = [
            'agentId' => $aid,
            'name' => $m['name'],
            'firstName' => $m['first_name'],
            'teamKey' => $m['team_key'],
            'teamName' => $m['team_name'],
            'roleLabel' => $m['role_label'],
            'isInactive' => $m['is_inactive'],
            'hasBook' => $m['has_book'],
            'cells' => $out,
            'total' => $rowTotal,
        ];
    }
    usort($rows, function ($x, $y) {
        if ($x['teamName'] !== $y['teamName']) return strcmp($x['teamName'], $y['teamName']);
        return $y['total']['sales'] <=> $x['total']['sales'];
    });

    json_response([
        'success' => true,
        'period' => ['year' => $year, 'month' => $month],
        'owned_source' => $ownedSource,
        'snapshot_date' => $snapDate,
        'segments' => $segmentsOut,
        'teams' => $teamsList,
        'agents' => $agentsList,
        'rows' => $rows,
        'totals' => ['bySegment' => $segTotals, 'grand' => $grand],
    ]);

} catch (Exception $e) {
    error_log('Telesale Segment Matrix API Error: ' . $e->getMessage());
    json_response(['success' => false, 'message' => 'Server error: ' . $e->getMessage()], 500);
}
