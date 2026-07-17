<?php
/**
 * Telesale Campaign Compare API — per-team › per-agent × per-segment, two-month comparison.
 *
 * Call side  — from call_import_logs (provider CDR, real durations):
 *     outbound only (rec_type = 2), agent = matched_user_id (role 6/7, company)
 *     customer = call_termination normalised (66XXXXXXXXX -> 0XXXXXXXXX), matched to customers.phone
 *     segment  = matched customer's CURRENT basket (customers.current_basket_key); unmatched -> "ไม่มีแคมเปญ"
 *       names_called = distinct customer phone dialed
 *       total_calls  = COUNT(*)
 *       answered     = status = 1 (รับสาย, any duration)
 *       missed       = status = 0 (ไม่รับสาย)
 *       talked       = status = 1 AND TIME_TO_SEC(duration) >= 30   (system standard "ได้คุย")
 *
 * Sale side  — from order_items (excl. cancelled / freebie):
 *     agent = COALESCE(oi.creator_id, o.creator_id) (role 6/7, company)
 *     segment = order_items.basket_key_at_sale -> campaign basket name; else "ไม่มีแคมเปญ"
 *       orders = COUNT(DISTINCT order id), sales = SUM(net_total)
 *
 * Ownership — from customers (CURRENT snapshot, not period-bound, same convention as call segment):
 *     owned = COUNT(*) of customers.assigned_to = agent, grouped by customers.current_basket_key.
 *     Segments with owned customers are shown even with zero call/sale activity in both periods.
 *
 * Teams: no `teams` table. team head = role-6 supervisor; a telesale's team is resolved via
 *   supervisor_id (-> role-6 user) OR team_id (matched to a role-6 supervisor's team_id).
 *   Team name = head supervisor's first_name. Unassigned -> "ไม่มีทีม".
 *
 * Params: month_a, year_a, month_b, year_b, agent_id (filter one agent), team (filter one team head id),
 *         segments[] (filter by segment/basket name; empty = all; may include "ไม่มีแคมเปญ")
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
    $isSupervisor = strpos($role, 'supervisor') !== false;
    $isAdmin = (strpos($role, 'admin') !== false && !$isSupervisor) || strpos($role, 'super') !== false;
    $isCEO = strpos($role, 'ceo') !== false;

    // Periods
    $nowY = intval(date('Y'));
    $nowM = intval(date('m'));
    $prev = strtotime(sprintf('%04d-%02d-01 -1 month', $nowY, $nowM));
    $monthB = isset($_GET['month_b']) ? intval($_GET['month_b']) : $nowM;
    $yearB  = isset($_GET['year_b'])  ? intval($_GET['year_b'])  : $nowY;
    $monthA = isset($_GET['month_a']) ? intval($_GET['month_a']) : intval(date('m', $prev));
    $yearA  = isset($_GET['year_a'])  ? intval($_GET['year_a'])  : intval(date('Y', $prev));

    $rangeOf = function ($y, $m) {
        $start = sprintf('%04d-%02d-01 00:00:00', $y, $m);
        $end = date('Y-m-d 00:00:00', strtotime($start . ' +1 month'));
        return [$start, $end];
    };
    [$startA, $endA] = $rangeOf($yearA, $monthA);
    [$startB, $endB] = $rangeOf($yearB, $monthB);

    $filterAgent = isset($_GET['agent_id']) ? intval($_GET['agent_id']) : 0;
    $filterTeam = isset($_GET['team']) && $_GET['team'] !== '' ? $_GET['team'] : null; // head id as string, '0' = ไม่มีทีม

    // ---- Campaign basket id -> name (dashboard_v2 active) — loaded early so every response
    // (including empty-result early exits) can carry segments_list for the segment filter dropdown.
    $campaignBaskets = [];
    $bc = $pdo->prepare("SELECT id, basket_name, display_order FROM basket_config WHERE target_page = 'dashboard_v2' AND is_active = 1 AND company_id = 1");
    $bc->execute();
    foreach ($bc->fetchAll(PDO::FETCH_ASSOC) as $b) {
        $campaignBaskets[(int) $b['id']] = ['name' => $b['basket_name'], 'order' => (int) $b['display_order']];
    }
    $NO_CAMPAIGN = 'ไม่มีแคมเปญ';

    // Distinct segment names ordered by display_order (duplicate names collapse to lowest order)
    $segNameOrder = [];
    foreach ($campaignBaskets as $b) {
        if (!isset($segNameOrder[$b['name']]) || $b['order'] < $segNameOrder[$b['name']]) $segNameOrder[$b['name']] = $b['order'];
    }
    asort($segNameOrder);
    $segmentsList = array_keys($segNameOrder);
    $segmentsList[] = $NO_CAMPAIGN;

    // Segment filter: segments[]=name (repeatable). Empty/absent = all segments.
    $filterSegments = null; // null = no filter; else name => true set
    if (isset($_GET['segments']) && is_array($_GET['segments'])) {
        $selSegs = array_values(array_filter(array_map('trim', $_GET['segments']), function ($s) { return $s !== ''; }));
        if (!empty($selSegs)) $filterSegments = array_flip($selSegs);
    }

    // ---- All role-6 supervisors in company (for naming teams), regardless of scope
    $supById = [];        // id => first_name
    $teamIdToSup = [];    // team_id => supervisor id
    $sv = $pdo->prepare("SELECT id, first_name, team_id FROM users WHERE role_id = 6 AND company_id = ?");
    $sv->execute([$companyId]);
    foreach ($sv->fetchAll(PDO::FETCH_ASSOC) as $s) {
        $supById[(int) $s['id']] = $s['first_name'];
        if ($s['team_id'] !== null && $s['team_id'] !== '' && (int) $s['team_id'] !== 0) {
            $teamIdToSup[(int) $s['team_id']] = (int) $s['id'];
        }
    }

    // ---- All role 6/7 in company (status kept so inactive-with-activity can be shown + tagged)
    $uStmt = $pdo->prepare("SELECT id, username, first_name, last_name, role, role_id, team_id, supervisor_id, status
                            FROM users WHERE role_id IN (6,7) AND company_id = ?");
    $uStmt->execute([$companyId]);

    $NO_TEAM = 'ไม่มีทีม';
    $resolveTeam = function ($u) use ($supById, $teamIdToSup, $NO_TEAM) {
        if ((int) $u['role_id'] === 6) {
            return ['key' => (string) (int) $u['id'], 'name' => $u['first_name'] ?: ('#' . $u['id'])];
        }
        $sid = $u['supervisor_id'] !== null ? (int) $u['supervisor_id'] : 0;
        if ($sid && isset($supById[$sid])) return ['key' => (string) $sid, 'name' => $supById[$sid]];
        $tid = $u['team_id'] !== null ? (int) $u['team_id'] : 0;
        if ($tid && isset($teamIdToSup[$tid])) {
            $h = $teamIdToSup[$tid];
            return ['key' => (string) $h, 'name' => $supById[$h]];
        }
        return ['key' => '0', 'name' => $NO_TEAM];
    };

    $userMap = [];     // id => meta
    foreach ($uStmt->fetchAll(PDO::FETCH_ASSOC) as $u) {
        $id = (int) $u['id'];
        $roleLabel = ((int) $u['role_id'] === 6) ? 'Sup' : 'Telesale';
        $t = $resolveTeam($u);
        $userMap[$id] = [
            'username' => $u['username'] ?: ('#' . $id),
            'first_name' => $u['first_name'] ?: ('#' . $id),
            'name' => trim(($u['first_name'] ?? '') . ' ' . ($u['last_name'] ?? '')),
            'role_label' => $roleLabel,
            'label' => ($u['first_name'] ?: ('#' . $id)) . ' [' . $roleLabel . ']',
            'team_key' => $t['key'],
            'team_name' => $t['name'],
            'is_inactive' => strtolower((string) $u['status']) !== 'active',
        ];
    }
    if (empty($userMap)) {
        json_response(['success' => true, 'periods' => ['a' => ['month' => $monthA, 'year' => $yearA], 'b' => ['month' => $monthB, 'year' => $yearB]], 'has_teams' => false, 'teams_list' => [], 'agents_list' => [], 'segments_list' => $segmentsList, 'owned' => 0, 'total' => null, 'groups' => []]);
        exit;
    }

    // Visible set per viewer role (mirror team resolution so supervisor sees full team incl. team_id-linked)
    if ($isAdmin || $isCEO) {
        $visibleIds = array_keys($userMap);
    } elseif ($isSupervisor) {
        // their team = members whose resolved team head is themselves (covers supervisor_id AND team_id links)
        $visibleIds = array_values(array_filter(array_keys($userMap), function ($id) use ($userMap, $currentUserId) {
            return $userMap[$id]['team_key'] === (string) $currentUserId;
        }));
        if (empty($visibleIds) && isset($userMap[$currentUserId])) $visibleIds = [$currentUserId];
    } else {
        $visibleIds = isset($userMap[$currentUserId]) ? [$currentUserId] : [];
    }
    $visibleSet = array_flip($visibleIds);

    // Teams present in the visible set
    $teamsList = [];
    foreach ($visibleIds as $id) $teamsList[$userMap[$id]['team_key']] = $userMap[$id]['team_name'];
    $hasTeams = false;
    foreach ($teamsList as $k => $v) {
        if ($k !== '0') { $hasTeams = true; break; }
    }

    // Apply filter (within visible set) to determine which agent ids to aggregate
    $activeIds = $visibleIds;
    if ($filterAgent > 0) {
        $activeIds = isset($visibleSet[$filterAgent]) ? [$filterAgent] : [];
    } elseif ($filterTeam !== null) {
        $activeIds = array_values(array_filter($visibleIds, function ($id) use ($userMap, $filterTeam) {
            return $userMap[$id]['team_key'] === (string) $filterTeam;
        }));
    }

    // Dropdown lists (full visible set)
    $agentsList = [];
    foreach ($visibleIds as $id) {
        $m = $userMap[$id];
        $agentsList[] = ['id' => $id, 'label' => $m['label'] . ($m['is_inactive'] ? ' (ออก)' : ''), 'team_key' => $m['team_key']];
    }
    usort($agentsList, function ($x, $y) { return strcmp($x['label'], $y['label']); });
    $teamsListOut = [];
    foreach ($teamsList as $k => $v) $teamsListOut[] = ['key' => $k, 'name' => $v];
    usort($teamsListOut, function ($x, $y) {
        if ($x['key'] === '0') return 1;
        if ($y['key'] === '0') return -1;
        return strcmp($x['name'], $y['name']);
    });

    if (empty($activeIds)) {
        json_response(['success' => true, 'periods' => ['a' => ['month' => $monthA, 'year' => $yearA], 'b' => ['month' => $monthB, 'year' => $yearB]], 'has_teams' => $hasTeams, 'teams_list' => $teamsListOut, 'agents_list' => $agentsList, 'segments_list' => $segmentsList, 'owned' => 0, 'total' => null, 'groups' => []]);
        exit;
    }
    $idPh = implode(',', array_fill(0, count($activeIds), '?'));

    // ---- Customer phone -> current basket id map (company)
    $phoneBasket = [];
    $cust = $pdo->prepare("SELECT phone, current_basket_key FROM customers WHERE company_id = ? AND phone IS NOT NULL AND phone <> ''");
    $cust->execute([$companyId]);
    while ($row = $cust->fetch(PDO::FETCH_ASSOC)) {
        $phoneBasket[$row['phone']] = $row['current_basket_key'];
    }

    $segOf = function ($basketId) use ($campaignBaskets, $NO_CAMPAIGN) {
        if ($basketId === null || $basketId === '') return $NO_CAMPAIGN;
        $bid = (int) $basketId;
        return isset($campaignBaskets[$bid]) ? $campaignBaskets[$bid]['name'] : $NO_CAMPAIGN;
    };
    $normPhone = function ($p) {
        $p = trim((string) $p);
        return strncmp($p, '66', 2) === 0 ? '0' . substr($p, 2) : $p;
    };
    $emptyMetrics = function () {
        return ['names_called' => 0, 'total_calls' => 0, 'answered' => 0, 'missed' => 0, 'talked' => 0, 'orders' => 0, 'sales' => 0.0];
    };

    $agents = [];
    $ensureSeg = function ($aid, $seg) use (&$agents, $emptyMetrics, $userMap) {
        if (!isset($agents[$aid])) {
            $agents[$aid] = [
                'agent_id' => $aid,
                'username' => $userMap[$aid]['username'],
                'label' => $userMap[$aid]['label'],
                'name' => $userMap[$aid]['name'],
                'role_label' => $userMap[$aid]['role_label'],
                'team_key' => $userMap[$aid]['team_key'],
                'team_name' => $userMap[$aid]['team_name'],
                'is_inactive' => $userMap[$aid]['is_inactive'],
                'seg' => [],
            ];
        }
        if (!isset($agents[$aid]['seg'][$seg])) {
            $agents[$aid]['seg'][$seg] = ['owned' => 0, 'a' => $emptyMetrics(), 'b' => $emptyMetrics()];
        }
    };

    $callSql = "
        SELECT matched_user_id AS agent_id, call_termination AS dialed,
               COUNT(*) AS total_calls,
               SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) AS answered,
               SUM(CASE WHEN status = 0 THEN 1 ELSE 0 END) AS missed,
               SUM(CASE WHEN status = 1 AND TIME_TO_SEC(duration) >= 30 THEN 1 ELSE 0 END) AS talked
        FROM call_import_logs
        WHERE rec_type = 2 AND matched_user_id IN ($idPh)
          AND call_date >= ? AND call_date < ?
        GROUP BY matched_user_id, call_termination
    ";
    $saleSql = "
        SELECT COALESCE(oi.creator_id, o.creator_id) AS agent_id,
               oi.basket_key_at_sale AS basket_id,
               COUNT(DISTINCT o.id) AS orders,
               COALESCE(SUM(CASE WHEN (oi.is_freebie = 0 OR oi.is_freebie IS NULL)
                                 THEN COALESCE(oi.net_total, oi.quantity * oi.price_per_unit) ELSE 0 END), 0) AS sales
        FROM order_items oi
        JOIN orders o ON oi.parent_order_id = o.id
        WHERE COALESCE(oi.creator_id, o.creator_id) IN ($idPh)
          AND o.order_date >= ? AND o.order_date < ?
          AND o.order_status <> 'Cancelled' AND oi.parent_item_id IS NULL
        GROUP BY COALESCE(oi.creator_id, o.creator_id), oi.basket_key_at_sale
    ";

    foreach (['a' => [$startA, $endA], 'b' => [$startB, $endB]] as $key => $rng) {
        $cs = $pdo->prepare($callSql);
        $cs->execute(array_merge($activeIds, [$rng[0], $rng[1]]));
        while ($r = $cs->fetch(PDO::FETCH_ASSOC)) {
            $aid = (int) $r['agent_id'];
            if (!isset($userMap[$aid])) continue;
            $seg = $segOf($phoneBasket[$normPhone($r['dialed'])] ?? null);
            if ($filterSegments !== null && !isset($filterSegments[$seg])) continue;
            $ensureSeg($aid, $seg);
            $m = &$agents[$aid]['seg'][$seg][$key];
            $m['names_called'] += 1;
            $m['total_calls'] += (int) $r['total_calls'];
            $m['answered'] += (int) $r['answered'];
            $m['missed'] += (int) $r['missed'];
            $m['talked'] += (int) $r['talked'];
            unset($m);
        }
        $ss = $pdo->prepare($saleSql);
        $ss->execute(array_merge($activeIds, [$rng[0], $rng[1]]));
        while ($r = $ss->fetch(PDO::FETCH_ASSOC)) {
            $aid = (int) $r['agent_id'];
            if (!isset($userMap[$aid])) continue;
            $seg = $segOf($r['basket_id']);
            if ($filterSegments !== null && !isset($filterSegments[$seg])) continue;
            $ensureSeg($aid, $seg);
            $m = &$agents[$aid]['seg'][$seg][$key];
            $m['orders'] += (int) $r['orders'];
            $m['sales'] += (float) $r['sales'];
            unset($m);
        }
    }

    // ---- Owned customers (CURRENT snapshot, not period-bound) — assigned_to agent, grouped by
    // current basket. (A true point-in-time historical version was attempted via customer_audit_log
    // but abandoned: the basket-routing system reassigns ownership across the whole customer pool so
    // heavily — ~900K+ change events — that even single-team-scoped reconstruction took 28s/94MB;
    // only single-agent scope was fast enough (~5s), which wasn't a usable threshold for this report.)
    $ownedSql = "
        SELECT assigned_to AS agent_id, current_basket_key AS basket_id, COUNT(*) AS cnt
        FROM customers
        WHERE company_id = ? AND assigned_to IN ($idPh)
        GROUP BY assigned_to, current_basket_key
    ";
    $os = $pdo->prepare($ownedSql);
    $os->execute(array_merge([$companyId], $activeIds));
    while ($r = $os->fetch(PDO::FETCH_ASSOC)) {
        $aid = (int) $r['agent_id'];
        if (!isset($userMap[$aid])) continue;
        $seg = $segOf($r['basket_id']);
        if ($filterSegments !== null && !isset($filterSegments[$seg])) continue;
        $ensureSeg($aid, $seg);
        $agents[$aid]['seg'][$seg]['owned'] += (int) $r['cnt'];
    }

    // Segment ordering
    $segOrder = [$NO_CAMPAIGN => -1];
    foreach ($campaignBaskets as $b) {
        if (!isset($segOrder[$b['name']]) || $b['order'] < $segOrder[$b['name']]) $segOrder[$b['name']] = $b['order'];
    }
    $segSort = function ($x, $y) use ($segOrder) {
        $ox = $segOrder[$x] ?? 999;
        $oy = $segOrder[$y] ?? 999;
        return $ox === $oy ? strcmp($x, $y) : ($ox <=> $oy);
    };
    $sumInto = function (&$dst, $src) {
        foreach (['names_called', 'total_calls', 'answered', 'missed', 'talked', 'orders', 'sales'] as $f) $dst[$f] += $src[$f];
    };

    // Build agent rows
    $agentOut = [];
    foreach ($agents as $a) {
        $agentTotal = ['a' => $emptyMetrics(), 'b' => $emptyMetrics()];
        $agentOwned = 0;
        $segNames = array_keys($a['seg']);
        usort($segNames, $segSort);
        $segments = [];
        foreach ($segNames as $segName) {
            $sd = $a['seg'][$segName];
            if (array_sum($sd['a']) <= 0 && array_sum($sd['b']) <= 0 && $sd['owned'] <= 0) continue;
            // "ไม่มีแคมเปญ" segment is hidden from the breakdown (these are unowned/reclaimed
            // customers, not a real campaign — see report discussion) but its activity still
            // rolls up into the agent/team/grand totals below. Exception: when the user
            // explicitly picked it in the segment filter, show the row so the numbers add up.
            if ($segName !== $NO_CAMPAIGN || ($filterSegments !== null && isset($filterSegments[$NO_CAMPAIGN]))) {
                $segments[] = ['segment' => $segName, 'owned' => $sd['owned'], 'a' => $sd['a'], 'b' => $sd['b']];
            }
            $sumInto($agentTotal['a'], $sd['a']);
            $sumInto($agentTotal['b'], $sd['b']);
            $agentOwned += $sd['owned'];
        }
        if (array_sum($agentTotal['a']) <= 0 && array_sum($agentTotal['b']) <= 0 && $agentOwned <= 0) continue;
        $agentOut[] = [
            'agent_id' => $a['agent_id'],
            'username' => $a['username'],
            'label' => $a['label'],
            'name' => $a['name'],
            'role_label' => $a['role_label'],
            'team_key' => $a['team_key'],
            'team_name' => $a['team_name'],
            'is_inactive' => $a['is_inactive'],
            'is_head' => $a['role_label'] === 'Sup',
            'owned' => $agentOwned,
            'total' => $agentTotal,
            'segments' => $segments,
        ];
    }

    // Group agents by team
    $grand = ['a' => $emptyMetrics(), 'b' => $emptyMetrics()];
    $grandOwned = 0;
    $groupsMap = [];
    foreach ($agentOut as $a) {
        $tk = $a['team_key'];
        if (!isset($groupsMap[$tk])) {
            $groupsMap[$tk] = ['team_key' => $tk, 'team_name' => $a['team_name'], 'owned' => 0, 'total' => ['a' => $emptyMetrics(), 'b' => $emptyMetrics()], 'agents' => []];
        }
        $groupsMap[$tk]['agents'][] = $a;
        $groupsMap[$tk]['owned'] += $a['owned'];
        $sumInto($groupsMap[$tk]['total']['a'], $a['total']['a']);
        $sumInto($groupsMap[$tk]['total']['b'], $a['total']['b']);
        $sumInto($grand['a'], $a['total']['a']);
        $sumInto($grand['b'], $a['total']['b']);
        $grandOwned += $a['owned'];
    }
    // Sort agents within team: head first, then by label
    foreach ($groupsMap as &$g) {
        usort($g['agents'], function ($x, $y) {
            if ($x['is_head'] !== $y['is_head']) return $x['is_head'] ? -1 : 1;
            return strcmp($x['label'], $y['label']);
        });
    }
    unset($g);
    // Sort groups: by team name, ไม่มีทีม last
    $groups = array_values($groupsMap);
    usort($groups, function ($x, $y) {
        if ($x['team_key'] === '0') return 1;
        if ($y['team_key'] === '0') return -1;
        return strcmp($x['team_name'], $y['team_name']);
    });

    json_response([
        'success' => true,
        'periods' => ['a' => ['month' => $monthA, 'year' => $yearA], 'b' => ['month' => $monthB, 'year' => $yearB]],
        'has_teams' => $hasTeams,
        'teams_list' => $teamsListOut,
        'agents_list' => $agentsList,
        'segments_list' => $segmentsList,
        'owned' => $grandOwned,
        'total' => $grand,
        'groups' => $groups,
    ]);

} catch (Exception $e) {
    error_log("Telesale Campaign Compare API Error: " . $e->getMessage());
    json_response(['success' => false, 'message' => 'Server error: ' . $e->getMessage()], 500);
}
