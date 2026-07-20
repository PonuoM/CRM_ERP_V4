<?php
/**
 * Monitor — Telesale Callstats API
 *
 * Returns a matrix of telesale agents and their performance per basket.
 * Data includes:
 *   - assigned: Total customers currently in this basket assigned to the agent
 *   - called: Unique customers called by this agent in this basket during the timeframe
 *   - appointments: Total appointments created by this agent in this basket during the timeframe
 *
 * Supported filters: today, this_week, this_month, this_year, all
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
    $role = strtolower($user['role'] ?? '');

    // Authorization: Admin, CEO, Supervisor can see.
    $isAdmin       = strpos($role, 'admin') !== false && strpos($role, 'supervisor') === false && strpos($role, 'admin page') === false;
    $isSupervisor  = strpos($role, 'supervisor') !== false;
    $isCEO         = strpos($role, 'ceo') !== false;
    
    $userId = (int) $user['id'];
    $stmt = $pdo->prepare("SELECT role_id, team_id FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    $userInfo = $stmt->fetch(PDO::FETCH_ASSOC);
    $roleId = (int) ($userInfo['role_id'] ?? 0);
    $userTeamId = $userInfo['team_id'] ?? null;

    // Parameters
    $filter = $_GET['filter'] ?? 'all';
    
    $startDate = null;
    $endDate = null;

    if ($filter === 'today') {
        $startDate = date('Y-m-d 00:00:00');
        $endDate = date('Y-m-d 23:59:59');
    } elseif ($filter === 'this_week') {
        $startDate = date('Y-m-d 00:00:00', strtotime('monday this week'));
        $endDate = date('Y-m-d 23:59:59', strtotime('sunday this week'));
    } elseif ($filter === 'this_month') {
        $startDate = date('Y-m-01 00:00:00');
        $endDate = date('Y-m-t 23:59:59');
    } elseif ($filter === 'this_year') {
        $startDate = date('Y-01-01 00:00:00');
        $endDate = date('Y-12-31 23:59:59');
    } elseif ($filter === 'custom') {
        if (!empty($_GET['start_date']) && !empty($_GET['end_date'])) {
            $startDate = str_replace('T', ' ', $_GET['start_date']);
            $endDate = str_replace('T', ' ', $_GET['end_date']);
        }
    }

    // 1. Get Baskets
    $stmt = $pdo->prepare("SELECT id, basket_key, basket_name FROM basket_config WHERE is_active = 1 AND company_id = ? AND target_page = 'dashboard_v2' ORDER BY display_order ASC");
    $stmt->execute([1]); // basket_config is global (company 1)
    $basketsRaw = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $baskets = [];
    $idToKeyMap = [];
    foreach ($basketsRaw as $b) {
        $baskets[] = [
            'basket_key' => $b['basket_key'],
            'basket_name' => $b['basket_name']
        ];
        $idToKeyMap[$b['id']] = $b['basket_key'];
        $idToKeyMap[$b['basket_key']] = $b['basket_key']; // fallback
    }

    // 2. Get Telesales (role_id 6, 7) based on viewing user's role
    $telesalesQuery = "SELECT id, first_name, last_name, role FROM users WHERE role_id IN (6, 7) AND status = 'active' AND company_id = ?";
    $paramsTelesales = [$companyId];

    if ($isAdmin || $isCEO) {
        // Can see all telesales
    } elseif ($roleId === 6) { // Supervisor Telesale
        if ($userTeamId !== null) {
            $telesalesQuery .= " AND (team_id = ? OR id = ?)";
            $paramsTelesales[] = $userTeamId;
            $paramsTelesales[] = $userId;
        } else {
            // No team_id assigned? Just see themselves
            $telesalesQuery .= " AND id = ?";
            $paramsTelesales[] = $userId;
        }
    } elseif ($roleId === 7) { // Telesale
        $telesalesQuery .= " AND id = ?";
        $paramsTelesales[] = $userId;
    } else {
        // Some other role? Just their own id
        $telesalesQuery .= " AND id = ?";
        $paramsTelesales[] = $userId;
    }
    
    $telesalesQuery .= " ORDER BY first_name ASC";
    
    $stmt = $pdo->prepare($telesalesQuery);
    $stmt->execute($paramsTelesales);
    $telesales = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    if(empty($telesales)) {
        json_response([
            'success' => true,
            'baskets' => $baskets,
            'data' => []
        ]);
        exit;
    }

    $userIds = array_column($telesales, 'id');
    $userIdsStr = implode(',', $userIds);

    // 3. Current Workload (ลูกค้าในมือ) - from customers table directly
    $currentAssignedQuery = "
        WITH CurrentCustomers AS (
            SELECT customer_id, assigned_to, current_basket_key, date_assigned
            FROM customers
            WHERE assigned_to IN ($userIdsStr) AND company_id = ?
        )
        SELECT 
            C.assigned_to, 
            C.current_basket_key, 
            COUNT(DISTINCT C.customer_id) as cnt,
            COUNT(DISTINCT CH.customer_id) as called_current,
            COUNT(DISTINCT A.customer_id) as appt_current
        FROM CurrentCustomers C
        LEFT JOIN call_history CH 
            ON C.customer_id = CH.customer_id AND C.assigned_to = CH.caller_id AND CH.date >= COALESCE(C.date_assigned, '1970-01-01')
        LEFT JOIN appointments A 
            ON C.customer_id = A.customer_id AND C.assigned_to = A.created_by AND A.created_at >= COALESCE(C.date_assigned, '1970-01-01')
        GROUP BY C.assigned_to, C.current_basket_key
    ";
    $stmt = $pdo->prepare($currentAssignedQuery);
    $stmt->execute([$companyId]);
    $currentAssignedStats = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // 3.5 Cohort KPI Logic: Unified query for distributed, called, and appointments
    $cohortQuery = "
        WITH Cohort AS (
            SELECT DISTINCT 
                a.customer_id, 
                a.new_value as assigned_to, 
                a.created_at as assignment_date,

                COALESCE(
                    (
                        SELECT new_value 
                        FROM customer_audit_log b 
                        WHERE b.customer_id = a.customer_id 
                          AND b.field_name = 'current_basket_key' 
                          AND b.created_at <= a.created_at + INTERVAL 5 SECOND
                        ORDER BY b.created_at DESC, b.id DESC 
                        LIMIT 1
                    ),
                    c.current_basket_key
                ) as current_basket_key
            FROM customer_audit_log a
            JOIN customers c ON a.customer_id = c.customer_id
            WHERE a.field_name = 'assigned_to'
              AND a.new_value IN ($userIdsStr)
              AND a.api_source LIKE 'distribution%'
              AND c.company_id = ?
    ";
    
    $paramsCohort = [$companyId];
    if ($startDate) {
        $cohortQuery .= " AND a.created_at BETWEEN ? AND ?";
        $paramsCohort[] = $startDate;
        $paramsCohort[] = $endDate;
    }
    
    $cohortQuery .= "
        )
        SELECT 
            C.assigned_to, 
            C.current_basket_key, 
            COUNT(DISTINCT C.customer_id) as assigned_total,
            COUNT(DISTINCT CH.customer_id) as called,
            COUNT(DISTINCT A.customer_id) as appointments
        FROM Cohort C
        LEFT JOIN call_history CH 
            ON C.customer_id = CH.customer_id AND C.assigned_to = CH.caller_id AND CH.date >= C.assignment_date
        LEFT JOIN appointments A 
            ON C.customer_id = A.customer_id AND C.assigned_to = A.created_by AND A.created_at >= C.assignment_date
        GROUP BY C.assigned_to, C.current_basket_key
    ";
    $stmt = $pdo->prepare($cohortQuery);
    $stmt->execute($paramsCohort);
    $cohortStats = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // 6. Aggregate Data into Matrix Format
    $dataMap = [];
    foreach ($telesales as $t) {
        $dataMap[$t['id']] = [
            'agent_id' => (int)$t['id'],
            'agent_name' => trim($t['first_name'] . ' ' . $t['last_name']),
            'stats' => []
        ];
        // Initialize baskets
        foreach ($baskets as $b) {
            $dataMap[$t['id']]['stats'][$b['basket_key']] = [
                'assigned_current' => 0,
                'called_current' => 0,
                'appt_current' => 0,
                'assigned_total' => 0,
                'called' => 0,
                'appointments' => 0
            ];
        }
    }

    // Populate Current Workload
    foreach ($currentAssignedStats as $row) {
        $agentId = $row['assigned_to'];
        $basketKey = $idToKeyMap[$row['current_basket_key']] ?? null;
        if ($basketKey && isset($dataMap[$agentId]['stats'][$basketKey])) {
            $dataMap[$agentId]['stats'][$basketKey]['assigned_current'] = (int)$row['cnt'];
            $dataMap[$agentId]['stats'][$basketKey]['called_current'] = (int)$row['called_current'];
            $dataMap[$agentId]['stats'][$basketKey]['appt_current'] = (int)$row['appt_current'];
        }
    }

    // Populate Cohort KPI Logic (Assigned Total, Called, Appointments)
    foreach ($cohortStats as $row) {
        $agentId = $row['assigned_to'];
        $basketKey = $idToKeyMap[$row['current_basket_key']] ?? null;
        if ($basketKey && isset($dataMap[$agentId]['stats'][$basketKey])) {
            $dataMap[$agentId]['stats'][$basketKey]['assigned_total'] = (int)$row['assigned_total'];
            $dataMap[$agentId]['stats'][$basketKey]['called'] = (int)$row['called'];
            $dataMap[$agentId]['stats'][$basketKey]['appointments'] = (int)$row['appointments'];
        }
    }

    // Filter out telesales that have 0 across all baskets if desired?
    // Let's keep them so the supervisor knows they did nothing.

    $finalData = array_values($dataMap);

    // --- Export Logic ---
    if (isset($_GET['export']) && $_GET['export'] === 'true') {
        $viewMode = $_GET['view_mode'] ?? 'performance';
        $agentIdFilter = $_GET['agent_id'] ?? 'all';
        
        // Filter agents if needed
        if ($agentIdFilter !== 'all') {
            $finalData = array_filter($finalData, function($a) use ($agentIdFilter) {
                return $a['agent_id'] == $agentIdFilter;
            });
        }
        
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="telesale_callstats_' . $viewMode . '_' . date('Ymd_His') . '.csv"');
        
        $output = fopen('php://output', 'w');
        // Add BOM for Excel UTF-8 support
        fprintf($output, chr(0xEF).chr(0xBB).chr(0xBF));
        
        // Build Headers
        $headers = ['รหัสพนักงาน', 'ชื่อพนักงาน'];
        foreach ($baskets as $b) {
            $bName = $b['basket_name'];
            if ($viewMode === 'performance') {
                $headers[] = "[{$bName}] รับแจก";
                $headers[] = "[{$bName}] โทรแล้ว";
                $headers[] = "[{$bName}] นัดหมาย";
            } else {
                $headers[] = "[{$bName}] ในมือ";
                $headers[] = "[{$bName}] โทรแล้ว";
                $headers[] = "[{$bName}] นัดหมาย";
            }
        }
        fputcsv($output, $headers);
        
        // Build Rows
        foreach ($finalData as $agent) {
            $row = [$agent['agent_id'], $agent['agent_name']];
            foreach ($baskets as $b) {
                $stat = $agent['stats'][$b['basket_key']] ?? null;
                if (!$stat) {
                    $row[] = '0';
                    $row[] = '0';
                    $row[] = '0';
                    continue;
                }
                
                if ($viewMode === 'performance') {
                    $row[] = $stat['assigned_total'];
                    $row[] = $stat['called'];
                    $row[] = $stat['appointments'];
                } else {
                    $row[] = $stat['assigned_current'];
                    $row[] = $stat['called_current'];
                    $row[] = $stat['appt_current'];
                }
            }
            fputcsv($output, $row);
        }
        
        fclose($output);
        exit;
    }

    json_response([
        'success' => true,
        'baskets' => $baskets,
        'data' => $finalData
    ]);

} catch (Throwable $e) {
    error_log("telesale_callstats.php error: " . $e->getMessage());
    json_response([
        'success' => false,
        'message' => 'Server error',
        'detail' => $e->getMessage()
    ], 500);
}
