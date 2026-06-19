<?php
/**
 * Monitor — Telesale Callstats Drilldown API
 *
 * Returns a detailed list of customers for a specific matrix cell.
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

    $agentId = isset($_GET['agent_id']) ? (int)$_GET['agent_id'] : 0;
    $basketKey = $_GET['basket_key'] ?? '';
    $viewMode = $_GET['view_mode'] ?? 'performance';
    $filter = $_GET['filter'] ?? 'today';
    
    // Pagination and Tab parameters
    $page = isset($_GET['page']) ? max(1, (int)$_GET['page']) : 1;
    $limit = isset($_GET['limit']) ? max(1, (int)$_GET['limit']) : 50;
    $tab = $_GET['tab'] ?? 'all'; // 'all', 'called', 'appt'

    if (!$agentId || !$basketKey) {
        json_response(['success' => false, 'message' => 'Missing agent_id or basket_key'], 400);
        exit;
    }

    // Security check: Can this user view this agent_id?
    if (!$isAdmin && !$isCEO) {
        if ($roleId === 6) { // Supervisor
            $stmt = $pdo->prepare("SELECT id FROM users WHERE id = ? AND (team_id = ? OR id = ?)");
            $stmt->execute([$agentId, $userTeamId, $userId]);
            if (!$stmt->fetch()) {
                json_response(['success' => false, 'message' => 'Forbidden: You can only view your team members'], 403);
                exit;
            }
        } else { // Normal Telesale or other
            if ($agentId !== $userId) {
                json_response(['success' => false, 'message' => 'Forbidden: You can only view your own stats'], 403);
                exit;
            }
        }
    }

    // Get basket ID for the provided basket Key to handle historical matching
    $stmt = $pdo->prepare("SELECT id FROM basket_config WHERE basket_key = ? AND company_id = ? LIMIT 1");
    $stmt->execute([$basketKey, 1]); // Global company 1 for baskets
    $basketId = $stmt->fetchColumn();

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

    $customers = [];
    $counts = ['total_all' => 0, 'total_called' => 0, 'total_appt' => 0];

    $offset = ($page - 1) * $limit;

    if ($viewMode === 'realtime') {
        // Realtime Mode: Look at current basket only
        
        // 1. Get Counts for all tabs
        $countQuery = "
            SELECT 
                COUNT(*) as total_all,
                SUM(CASE WHEN (SELECT COUNT(*) FROM call_history ch WHERE ch.customer_id = c.customer_id AND ch.caller_id = c.assigned_to AND ch.date >= COALESCE(c.date_assigned, '1970-01-01')) > 0 THEN 1 ELSE 0 END) as total_called,
                SUM(CASE WHEN (SELECT COUNT(*) FROM appointments a WHERE a.customer_id = c.customer_id AND a.created_by = c.assigned_to AND a.created_at >= COALESCE(c.date_assigned, '1970-01-01')) > 0 THEN 1 ELSE 0 END) as total_appt
            FROM customers c
            WHERE c.assigned_to = ? AND c.company_id = ?
              AND (c.current_basket_key = ? OR c.current_basket_key = ?)
        ";
        $stmt = $pdo->prepare($countQuery);
        $stmt->execute([$agentId, $companyId, $basketKey, (string)$basketId]);
        $countsRaw = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($countsRaw) {
            $counts = [
                'total_all' => (int)$countsRaw['total_all'],
                'total_called' => (int)$countsRaw['total_called'],
                'total_appt' => (int)$countsRaw['total_appt']
            ];
        }

        // 2. Fetch paginated data based on tab
        $query = "
            SELECT 
                c.customer_id,
                c.first_name,
                c.last_name,
                c.phone,
                c.assigned_to,
                c.current_basket_key,
                (SELECT COUNT(*) FROM call_history ch WHERE ch.customer_id = c.customer_id AND ch.caller_id = c.assigned_to AND ch.date >= COALESCE(c.date_assigned, '1970-01-01')) as call_count,
                (SELECT COUNT(*) FROM appointments a WHERE a.customer_id = c.customer_id AND a.created_by = c.assigned_to AND a.created_at >= COALESCE(c.date_assigned, '1970-01-01')) as appt_count
            FROM customers c
            WHERE c.assigned_to = ? AND c.company_id = ?
              AND (c.current_basket_key = ? OR c.current_basket_key = ?)
        ";
        
        if ($tab === 'called') {
            $query .= " AND (SELECT COUNT(*) FROM call_history ch WHERE ch.customer_id = c.customer_id AND ch.caller_id = c.assigned_to AND ch.date >= COALESCE(c.date_assigned, '1970-01-01')) > 0";
        } elseif ($tab === 'appt') {
            $query .= " AND (SELECT COUNT(*) FROM appointments a WHERE a.customer_id = c.customer_id AND a.created_by = c.assigned_to AND a.created_at >= COALESCE(c.date_assigned, '1970-01-01')) > 0";
        }
        
        $query .= " ORDER BY c.customer_id DESC LIMIT ? OFFSET ?";
        
        $stmt = $pdo->prepare($query);
        $stmt->bindValue(1, $agentId, PDO::PARAM_INT);
        $stmt->bindValue(2, $companyId, PDO::PARAM_INT);
        $stmt->bindValue(3, $basketKey, PDO::PARAM_STR);
        $stmt->bindValue(4, (string)$basketId, PDO::PARAM_STR);
        $stmt->bindValue(5, $limit, PDO::PARAM_INT);
        $stmt->bindValue(6, $offset, PDO::PARAM_INT);
        $stmt->execute();
        $customers = $stmt->fetchAll(PDO::FETCH_ASSOC);

    } else {
        // Performance Mode: Cohort Analysis
        $cohortBaseQuery = "
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
                    ) as historical_basket_key
                FROM customer_audit_log a
                JOIN customers c ON a.customer_id = c.customer_id
                WHERE a.field_name = 'assigned_to'
                  AND a.new_value = ?
                  AND a.api_source LIKE 'distribution%'
                  AND c.company_id = ?
        ";
        
        $paramsCohort = [$agentId, $companyId];
        if ($startDate) {
            $cohortBaseQuery .= " AND a.created_at BETWEEN ? AND ?";
            $paramsCohort[] = $startDate;
            $paramsCohort[] = $endDate;
        }
        $cohortBaseQuery .= " )";
        
        // 1. Get Counts for all tabs
        $countQuery = $cohortBaseQuery . "
            SELECT 
                COUNT(*) as total_all,
                SUM(CASE WHEN (SELECT COUNT(*) FROM call_history ch WHERE ch.customer_id = co.customer_id AND ch.caller_id = co.assigned_to AND ch.date >= co.assignment_date) > 0 THEN 1 ELSE 0 END) as total_called,
                SUM(CASE WHEN (SELECT COUNT(*) FROM appointments a WHERE a.customer_id = co.customer_id AND a.created_by = co.assigned_to AND a.created_at >= co.assignment_date) > 0 THEN 1 ELSE 0 END) as total_appt
            FROM Cohort co
            WHERE (co.historical_basket_key = ? OR co.historical_basket_key = ?)
        ";
        $paramsCount = array_merge($paramsCohort, [$basketKey, (string)$basketId]);
        $stmt = $pdo->prepare($countQuery);
        $stmt->execute($paramsCount);
        $countsRaw = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($countsRaw) {
            $counts = [
                'total_all' => (int)$countsRaw['total_all'],
                'total_called' => (int)$countsRaw['total_called'],
                'total_appt' => (int)$countsRaw['total_appt']
            ];
        }

        // 2. Fetch paginated data based on tab
        $dataQuery = $cohortBaseQuery . "
            SELECT 
                co.customer_id,
                c.first_name,
                c.last_name,
                c.phone,
                co.assigned_to,
                co.historical_basket_key,
                (SELECT COUNT(*) FROM call_history ch WHERE ch.customer_id = co.customer_id AND ch.caller_id = co.assigned_to AND ch.date >= co.assignment_date) as call_count,
                (SELECT COUNT(*) FROM appointments a WHERE a.customer_id = co.customer_id AND a.created_by = co.assigned_to AND a.created_at >= co.assignment_date) as appt_count
            FROM Cohort co
            JOIN customers c ON co.customer_id = c.customer_id
            WHERE (co.historical_basket_key = ? OR co.historical_basket_key = ?)
        ";
        
        if ($tab === 'called') {
            $dataQuery .= " AND (SELECT COUNT(*) FROM call_history ch WHERE ch.customer_id = co.customer_id AND ch.caller_id = co.assigned_to AND ch.date >= co.assignment_date) > 0";
        } elseif ($tab === 'appt') {
            $dataQuery .= " AND (SELECT COUNT(*) FROM appointments a WHERE a.customer_id = co.customer_id AND a.created_by = co.assigned_to AND a.created_at >= co.assignment_date) > 0";
        }
        
        $dataQuery .= " ORDER BY co.customer_id DESC LIMIT ? OFFSET ?";
        
        $stmt = $pdo->prepare($dataQuery);
        $paramIdx = 1;
        foreach ($paramsCohort as $p) {
            $stmt->bindValue($paramIdx++, $p);
        }
        $stmt->bindValue($paramIdx++, $basketKey);
        $stmt->bindValue($paramIdx++, (string)$basketId);
        $stmt->bindValue($paramIdx++, $limit, PDO::PARAM_INT);
        $stmt->bindValue($paramIdx++, $offset, PDO::PARAM_INT);
        
        $stmt->execute();
        $customers = $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    // Format the response array
    $formatted = [];
    foreach ($customers as $c) {
        $formatted[] = [
            'customer_id' => (int)$c['customer_id'],
            'full_name' => trim($c['first_name'] . ' ' . $c['last_name']),
            'phone' => $c['phone'], // User requested full phone number
            'has_called' => (int)$c['call_count'] > 0,
            'has_appointment' => (int)$c['appt_count'] > 0,
        ];
    }

    $totalRecords = $counts['total_all'];
    if ($tab === 'called') $totalRecords = $counts['total_called'];
    if ($tab === 'appt') $totalRecords = $counts['total_appt'];
    
    $totalPages = ceil($totalRecords / $limit);

    json_response([
        'success' => true,
        'view_mode' => $viewMode,
        'agent_id' => $agentId,
        'basket_key' => $basketKey,
        'tab' => $tab,
        'pagination' => [
            'current_page' => $page,
            'total_pages' => $totalPages,
            'total_records' => $totalRecords,
            'limit' => $limit
        ],
        'counts' => $counts,
        'data' => $formatted
    ]);

} catch (Throwable $e) {
    error_log("telesale_callstats_drilldown.php error: " . $e->getMessage());
    json_response([
        'success' => false,
        'message' => 'Server error',
        'detail' => $e->getMessage()
    ], 500);
}
