<?php
/**
 * Telesale Call Report API — call-log-level report (1 row per call)
 *
 * Data source: internal `call_history` (status / result / notes recorded by telesale)
 * Scope: callers with role_id 6 (Supervisor Telesale) or 7 (Telesale) in the viewer's company.
 *
 * Notes / gotchas (verified against production primacom_mini_erp):
 *   - call_history.caller_id is the reliable FK to users.id (the free-text `caller`
 *     column is inconsistent: "[Telesale]", "[Telelsale]" typo, "[Supervisor]"...).
 *     Rows without caller_id are excluded (INNER JOIN users).
 *   - customers.current_basket_key stores the basket_config.ID (numeric), NOT the
 *     string basket_key, so the bucket join is bc.id = c.current_basket_key.
 *
 * Params: month, year, agent_id, call_status, call_result, search, page, pageSize
 * Returns: { success, rows[], agents[], statuses[], results[], pagination, summary, filters }
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
    $currentUserRole = strtolower($user['role'] ?? '');

    // Role checks (mirror sales_sheet.php conventions)
    $isSupervisor = strpos($currentUserRole, 'supervisor') !== false;
    $isAdmin = (strpos($currentUserRole, 'admin') !== false && !$isSupervisor)
        || $currentUserRole === 'super admin'
        || (strpos($currentUserRole, 'super') !== false && !$isSupervisor);
    $isCEO = strpos($currentUserRole, 'ceo') !== false || $currentUserRole === 'ceo';

    // Parameters
    $month = isset($_GET['month']) ? intval($_GET['month']) : intval(date('m'));
    $year = isset($_GET['year']) ? intval($_GET['year']) : intval(date('Y'));
    $agentId = isset($_GET['agent_id']) ? intval($_GET['agent_id']) : 0;
    $callStatus = isset($_GET['call_status']) ? trim($_GET['call_status']) : '';
    $callResult = isset($_GET['call_result']) ? trim($_GET['call_result']) : '';
    $search = isset($_GET['search']) ? trim($_GET['search']) : '';
    $page = isset($_GET['page']) ? max(1, intval($_GET['page'])) : 1;
    $pageSize = isset($_GET['pageSize']) ? min(10000, max(10, intval($_GET['pageSize']))) : 200;

    // Date range: inclusive start, exclusive end (on call_history.date)
    $startDate = sprintf('%04d-%02d-01 00:00:00', $year, $month);
    $endDate = date('Y-m-d 00:00:00', strtotime($startDate . ' +1 month'));

    // Determine which telesale agents (role_id 6/7) the viewer may see.
    // Admin/CEO: everyone in company. Supervisor: self + direct reports. Telesale: self.
    $agentScopeFilter = "";
    $agentScopeParams = [];

    if (!$isAdmin && !$isCEO) {
        if ($isSupervisor) {
            $teamStmt = $pdo->prepare(
                "SELECT id FROM users
                 WHERE (id = ? OR supervisor_id = ?) AND role_id IN (6,7) AND company_id = ?"
            );
            $teamStmt->execute([$currentUserId, $currentUserId, $companyId]);
            $teamIds = $teamStmt->fetchAll(PDO::FETCH_COLUMN);
            if (empty($teamIds)) {
                $teamIds = [$currentUserId];
            }
            $placeholders = implode(',', array_fill(0, count($teamIds), '?'));
            $agentScopeFilter = " AND u.id IN ($placeholders)";
            $agentScopeParams = $teamIds;
        } else {
            $agentScopeFilter = " AND u.id = ?";
            $agentScopeParams = [$currentUserId];
        }
    }

    // Optional explicit agent filter (must still respect scope above)
    $extraFilter = "";
    $extraParams = [];
    if ($agentId > 0) {
        $extraFilter .= " AND u.id = ?";
        $extraParams[] = $agentId;
    }
    if ($callStatus !== '') {
        $extraFilter .= " AND ch.status = ?";
        $extraParams[] = $callStatus;
    }
    if ($callResult !== '') {
        $extraFilter .= " AND ch.result = ?";
        $extraParams[] = $callResult;
    }
    if ($search !== '') {
        $extraFilter .= " AND (
            c.phone LIKE ?
            OR CONCAT(COALESCE(c.first_name,''), ' ', COALESCE(c.last_name,'')) LIKE ?
            OR ch.notes LIKE ?
        )";
        $searchWild = "%$search%";
        $extraParams = array_merge($extraParams, [$searchWild, $searchWild, $searchWild]);
    }

    // Shared FROM + WHERE
    $fromWhere = "
        FROM call_history ch
        JOIN users u ON u.id = ch.caller_id AND u.role_id IN (6,7) AND u.company_id = ?
        LEFT JOIN customers c ON c.customer_id = ch.customer_id
        LEFT JOIN basket_config bc ON bc.id = c.current_basket_key
        WHERE ch.date >= ? AND ch.date < ?
        $agentScopeFilter
        $extraFilter
    ";
    $baseParams = array_merge([$companyId, $startDate, $endDate], $agentScopeParams, $extraParams);

    // Count total
    $countStmt = $pdo->prepare("SELECT COUNT(*) " . $fromWhere);
    $countStmt->execute($baseParams);
    $totalRows = intval($countStmt->fetchColumn());

    // Summary: total calls + "ได้คุย" (talked) calls
    $summaryStmt = $pdo->prepare(
        "SELECT
            COUNT(*) AS total_calls,
            SUM(CASE WHEN ch.status = 'ได้คุย' OR ch.result = 'ได้คุย' THEN 1 ELSE 0 END) AS talked_calls,
            COUNT(DISTINCT ch.customer_id) AS unique_customers,
            COUNT(DISTINCT u.id) AS active_agents
        " . $fromWhere
    );
    $summaryStmt->execute($baseParams);
    $summary = $summaryStmt->fetch(PDO::FETCH_ASSOC) ?: [];

    // Data rows
    $offset = ($page - 1) * $pageSize;
    $dataSql = "
        SELECT
            ch.id,
            ch.date AS call_date,
            c.phone AS customer_phone,
            TRIM(CONCAT(COALESCE(c.first_name,''), ' ', COALESCE(c.last_name,''))) AS customer_name,
            ch.status AS call_status,
            ch.result AS call_result,
            TRIM(CONCAT(COALESCE(u.first_name,''), ' ', COALESCE(u.last_name,''))) AS caller_name,
            u.id AS caller_id,
            bc.basket_name AS basket_name,
            c.current_basket_key AS basket_id,
            ch.notes,
            ch.duration,
            ch.customer_id
        " . $fromWhere . "
        ORDER BY ch.date DESC, ch.id DESC
        LIMIT ? OFFSET ?
    ";
    $allParams = array_merge($baseParams, [$pageSize, $offset]);
    $dataStmt = $pdo->prepare($dataSql);
    $dataStmt->execute($allParams);
    $rows = $dataStmt->fetchAll(PDO::FETCH_ASSOC);

    // Agent dropdown — telesale role 6/7 within the viewer's scope
    $agentSql = "
        SELECT u.id, TRIM(CONCAT(COALESCE(u.first_name,''), ' ', COALESCE(u.last_name,''))) AS name, u.role_id
        FROM users u
        WHERE u.role_id IN (6,7) AND u.company_id = ? AND u.status = 'active'
        $agentScopeFilter
        ORDER BY u.first_name, u.last_name
    ";
    $agentParams = array_merge([$companyId], $agentScopeParams);
    $agentStmt = $pdo->prepare($agentSql);
    $agentStmt->execute($agentParams);
    $agents = $agentStmt->fetchAll(PDO::FETCH_ASSOC);

    json_response([
        'success' => true,
        'rows' => $rows,
        'agents' => $agents,
        'summary' => [
            'total_calls' => intval($summary['total_calls'] ?? 0),
            'talked_calls' => intval($summary['talked_calls'] ?? 0),
            'unique_customers' => intval($summary['unique_customers'] ?? 0),
            'active_agents' => intval($summary['active_agents'] ?? 0),
        ],
        'pagination' => [
            'page' => $page,
            'pageSize' => $pageSize,
            'total' => $totalRows,
            'totalPages' => $pageSize > 0 ? (int) ceil($totalRows / $pageSize) : 0,
        ],
        'filters' => [
            'month' => $month,
            'year' => $year,
        ],
    ]);

} catch (Exception $e) {
    error_log("Telesale Call Report API Error: " . $e->getMessage());
    json_response(['success' => false, 'message' => 'Server error: ' . $e->getMessage()], 500);
}
