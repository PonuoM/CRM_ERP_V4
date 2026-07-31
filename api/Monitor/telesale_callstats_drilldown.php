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
        // 1. Get Counts for all tabs
        $countQuery = "
            WITH Base AS (
                SELECT 
                    c.customer_id,
                    (SELECT COUNT(*) FROM call_history ch WHERE ch.customer_id = c.customer_id AND ch.caller_id = c.assigned_to AND ch.date >= COALESCE(c.date_assigned, '1970-01-01')) as has_called,
                    (SELECT COUNT(*) FROM appointments a WHERE a.customer_id = c.customer_id AND a.created_by = c.assigned_to AND a.created_at >= COALESCE(c.date_assigned, '1970-01-01')) as has_appt
                FROM customers c
                WHERE c.assigned_to = ? AND c.company_id = ?
                  AND (c.current_basket_key = ? OR c.current_basket_key = ?)
            )
            SELECT 
                COUNT(*) as total_all,
                SUM(CASE WHEN has_called = 0 AND has_appt = 0 THEN 1 ELSE 0 END) as total_not_called,
                SUM(CASE WHEN has_called > 0 AND has_appt = 0 THEN 1 ELSE 0 END) as total_called_no_appt,
                SUM(CASE WHEN has_called > 0 AND has_appt > 0 THEN 1 ELSE 0 END) as total_called_and_appt,
                SUM(CASE WHEN has_called = 0 AND has_appt > 0 THEN 1 ELSE 0 END) as total_appt_no_call
            FROM Base
        ";
        $stmt = $pdo->prepare($countQuery);
        $stmt->execute([$agentId, $companyId, $basketKey, (string)$basketId]);
        $countsRaw = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($countsRaw) {
            $counts = [
                'total_all' => (int)$countsRaw['total_all'],
                'total_not_called' => (int)$countsRaw['total_not_called'],
                'total_called_no_appt' => (int)$countsRaw['total_called_no_appt'],
                'total_called_and_appt' => (int)$countsRaw['total_called_and_appt'],
                'total_appt_no_call' => (int)$countsRaw['total_appt_no_call']
            ];
        }

        // 2. Fetch paginated data based on tab
        $query = "
            WITH Base AS (
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
            )
            SELECT * FROM Base WHERE 1=1
        ";
        
        if ($tab === 'not_called') {
            $query .= " AND call_count = 0 AND appt_count = 0";
        } elseif ($tab === 'called_no_appt') {
            $query .= " AND call_count > 0 AND appt_count = 0";
        } elseif ($tab === 'called_and_appt') {
            $query .= " AND call_count > 0 AND appt_count > 0";
        } elseif ($tab === 'appt_no_call') {
            $query .= " AND call_count = 0 AND appt_count > 0";
        }
        
        $query .= " ORDER BY customer_id DESC LIMIT ? OFFSET ?";
        
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
        // 1. Get Counts for all tabs
        $countQuery = $cohortBaseQuery . "
            , Base AS (
                SELECT 
                    co.customer_id,
                    (SELECT COUNT(*) FROM call_history ch WHERE ch.customer_id = co.customer_id AND ch.caller_id = co.assigned_to AND ch.date >= co.assignment_date) as has_called,
                    (SELECT COUNT(*) FROM appointments a WHERE a.customer_id = co.customer_id AND a.created_by = co.assigned_to AND a.created_at >= co.assignment_date) as has_appt
                FROM Cohort co
                WHERE (co.historical_basket_key = ? OR co.historical_basket_key = ?)
            )
            SELECT 
                COUNT(*) as total_all,
                SUM(CASE WHEN has_called = 0 AND has_appt = 0 THEN 1 ELSE 0 END) as total_not_called,
                SUM(CASE WHEN has_called > 0 AND has_appt = 0 THEN 1 ELSE 0 END) as total_called_no_appt,
                SUM(CASE WHEN has_called > 0 AND has_appt > 0 THEN 1 ELSE 0 END) as total_called_and_appt,
                SUM(CASE WHEN has_called = 0 AND has_appt > 0 THEN 1 ELSE 0 END) as total_appt_no_call
            FROM Base
        ";
        $paramsCount = array_merge($paramsCohort, [$basketKey, (string)$basketId]);
        $stmt = $pdo->prepare($countQuery);
        $stmt->execute($paramsCount);
        $countsRaw = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($countsRaw) {
            $counts = [
                'total_all' => (int)$countsRaw['total_all'],
                'total_not_called' => (int)$countsRaw['total_not_called'],
                'total_called_no_appt' => (int)$countsRaw['total_called_no_appt'],
                'total_called_and_appt' => (int)$countsRaw['total_called_and_appt'],
                'total_appt_no_call' => (int)$countsRaw['total_appt_no_call']
            ];
        }

        // 2. Fetch paginated data based on tab
        $dataQuery = $cohortBaseQuery . "
            , Base AS (
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
            )
            SELECT * FROM Base WHERE 1=1
        ";
        
        if ($tab === 'not_called') {
            $dataQuery .= " AND call_count = 0 AND appt_count = 0";
        } elseif ($tab === 'called_no_appt') {
            $dataQuery .= " AND call_count > 0 AND appt_count = 0";
        } elseif ($tab === 'called_and_appt') {
            $dataQuery .= " AND call_count > 0 AND appt_count > 0";
        } elseif ($tab === 'appt_no_call') {
            $dataQuery .= " AND call_count = 0 AND appt_count > 0";
        }
        
        $dataQuery .= " ORDER BY customer_id DESC LIMIT ? OFFSET ?";
        
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

    $totalRecords = $counts['total_all'] ?? 0;
    if ($tab === 'not_called') $totalRecords = $counts['total_not_called'] ?? 0;
    if ($tab === 'called_no_appt') $totalRecords = $counts['total_called_no_appt'] ?? 0;
    if ($tab === 'called_and_appt') $totalRecords = $counts['total_called_and_appt'] ?? 0;
    if ($tab === 'appt_no_call') $totalRecords = $counts['total_appt_no_call'] ?? 0;
    
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
