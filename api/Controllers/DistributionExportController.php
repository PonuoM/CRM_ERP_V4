<?php

class DistributionExportController {



public static function handleGetCronLogs($pdo) {
        $authUser = get_authenticated_user($pdo);
        if (!$authUser) {
            http_response_code(401);
            echo json_encode(["ok" => false, "message" => "Unauthorized"]);
            return;
        }
        $companyId = $authUser['company_id'];
    if (!isset($companyId) || empty($companyId)) {
        http_response_code(400);
        echo json_encode(['error' => 'Company ID is required']);
        return;
    }

    // Role check logic would typically be handled by session middleware,
    // assuming it is passed or we verify it if needed.

    $limit = $_GET['limit'] ?? 20;

    $stmt = $pdo->prepare("SELECT id, started_at, finished_at, status, snapshot_before, snapshot_after, error_count, transferred_count FROM cron_execution_logs WHERE status = 'success' ORDER BY id DESC LIMIT ?");
    // Ensure limit is bound as an integer
    $stmt->bindValue(1, (int)$limit, PDO::PARAM_INT);
    $stmt->execute();
    $logs = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $results = [];
    
    // Get Basket Names for mapping
    $basketNames = [];
    $bStmt = $pdo->query("SELECT id, basket_name FROM basket_config");
    while ($b = $bStmt->fetch(PDO::FETCH_ASSOC)) {
        $basketNames[$b['id']] = $b['basket_name'];
    }

    foreach ($logs as $log) {
        $before = json_decode($log['snapshot_before'], true);
        $after = json_decode($log['snapshot_after'], true);
        $cKey = 'company_' . $companyId;
        
        $cBefore = $before[$cKey] ?? [];
        $cAfter = $after[$cKey] ?? [];

        $cBeforeDist = $cBefore['distribution_pool']['__total__'] ?? 0;
        $cAfterDist = $cAfter['distribution_pool']['__total__'] ?? 0;

        $distBreakdown = [];
        $poolKeys = array_unique(array_merge(array_keys($cBefore['distribution_pool'] ?? []), array_keys($cAfter['distribution_pool'] ?? [])));
        foreach ($poolKeys as $pk) {
            if ($pk === '__total__') continue;
            $bk = $cBefore['distribution_pool'][$pk] ?? 0;
            $ak = $cAfter['distribution_pool'][$pk] ?? 0;
            if ($bk !== $ak) {
                $basketName = $basketNames[$pk] ?? "Basket ID: $pk";
                $distBreakdown[] = [
                    'basket_key' => $pk,
                    'basket_name' => $basketName,
                    'before' => $bk,
                    'after' => $ak,
                    'diff' => $ak - $bk
                ];
            }
        }

        // We can safely unset massive JSON objects before sending to frontend
        $results[] = [
            'id' => $log['id'],
            'started_at' => $log['started_at'],
            'finished_at' => $log['finished_at'],
            'status' => $log['status'],
            'transferred_count' => $log['transferred_count'], // Global trans count
            'dist_diff' => $cAfterDist - $cBeforeDist,
            'dist_total_after' => $cAfterDist,
            'dist_breakdown' => $distBreakdown
        ];
    }

    echo json_encode(['ok' => true, 'data' => $results]);
}

    public static function summary_export($pdo) {




        $authUser = get_authenticated_user($pdo);
        if (!$authUser) {
            http_response_code(401);
            echo json_encode(["ok" => false, "message" => "Unauthorized"]);
            return;
        }
        $companyId = $authUser['company_id'];
$startDate = $_GET['start_date'] ?? null;
$endDate = $_GET['end_date'] ?? null;
$type = $_GET['type'] ?? 'all';
$basketKey = $_GET['basket_key'] ?? 'all';
$sessionTag = $_GET['session_tag'] ?? '';

if (!$startDate || !$endDate) {
    http_response_code(400);
    echo json_encode(['error' => 'start_date and end_date are required']);
    exit;
}

// Ensure end date covers the full day
if (strpos($endDate, ' ') === false) {
    $endDate .= ' 23:59:59';
}

try {
    // 1. Fetch active agents (Telesale and Supervisors)
    $stmtAgents = $pdo->prepare("
        SELECT id as agent_id, CONCAT(first_name, ' ', last_name) as agent_name 
        FROM users 
        WHERE company_id = ? 
          AND status = 'active' 
          AND (LOWER(role) = 'telesale' OR LOWER(role) LIKE '%supervisor%')
        ORDER BY first_name ASC, last_name ASC
    ");
    $stmtAgents->execute([$companyId]);
    $agents = $stmtAgents->fetchAll(PDO::FETCH_ASSOC);

    // 2. Fetch Dashboard Baskets (Target baskets for agents)
    $stmtBaskets = $pdo->prepare("
        SELECT basket_key, basket_name 
        FROM basket_config 
        WHERE company_id = 1 
          AND target_page = 'dashboard_v2' 
          AND is_active = 1
        ORDER BY display_order ASC
    ");
    $stmtBaskets->execute();
    $baskets = $stmtBaskets->fetchAll(PDO::FETCH_ASSOC);
    
    // Create a map from pool basket to dashboard basket for Distribution (Received) logic
    $stmtPoolMap = $pdo->prepare("
        SELECT basket_key as pool_key, linked_basket_key as dash_key 
        FROM basket_config 
        WHERE company_id = 1 AND target_page = 'distribution'
    ");
    $stmtPoolMap->execute();
    $poolToDashMap = [];
    foreach ($stmtPoolMap->fetchAll(PDO::FETCH_ASSOC) as $row) {
        if ($row['dash_key']) {
            $poolToDashMap[$row['pool_key']] = $row['dash_key'];
        }
    }


    $filterParams = [];
    $typeFilter = "";
    if ($type === 'distribution') {
        $typeFilter = " AND (ds.distribution_mode NOT LIKE '%Reclaim%' AND ds.distribution_mode NOT LIKE '%Transfer%') ";
    } else if ($type === 'reclaim') {
        $typeFilter = " AND (ds.distribution_mode LIKE '%Reclaim%' OR ds.distribution_mode LIKE '%Transfer%') ";
    }

    $basketFilter = "";
    if ($basketKey && $basketKey !== 'all') {
        $basketFilter = " AND EXISTS (SELECT 1 FROM distribution_session_details _dsd WHERE _dsd.session_id = ds.id AND _dsd.previous_basket_key = ?) ";
        $filterParams[] = $basketKey;
    }

    $tagFilter = "";
    if ($sessionTag && $sessionTag !== 'all' && $sessionTag !== '') {
        $tagParts = explode(',', $sessionTag);
        $hasNone = in_array('none', $tagParts);
        $validTagIds = array_filter(array_map('intval', array_diff($tagParts, ['none'])));
        
        $tagConditions = [];
        if (!empty($validTagIds)) {
            $placeholders = implode(',', array_fill(0, count($validTagIds), '?'));
            $tagConditions[] = "ds.tag_id IN ($placeholders)";
            $filterParams = array_merge($filterParams, $validTagIds);
        }
        if ($hasNone) {
            $tagConditions[] = "ds.tag_id IS NULL";
        }
        
        if (!empty($tagConditions)) {
            $tagFilter = " AND (" . implode(" OR ", $tagConditions) . ") ";
        } else {
            // Guarantee empty result if some weird string was passed
            $tagFilter = " AND 1=0 ";
        }
    }

    // 3. Fetch Received (Distributed to Agents)
    // dsd.agent_id is the receiver.
    // ds.source_basket is the pool basket it came from (we map this to dashboard basket)
    $stmtReceived = $pdo->prepare("
        SELECT 
            dsd.agent_id,
            ds.source_basket as pool_basket,
            COUNT(dsd.id) as received_count
        FROM distribution_session_details dsd
        JOIN distribution_sessions ds ON dsd.session_id = ds.id
        WHERE ds.company_id = ? 
          AND ds.distribution_mode NOT IN ('Bulk Reclaim', 'Bulk Transfer', 'Undo Partial', 'Undo Full')
          AND ds.session_status = 'completed'
          AND ds.created_at BETWEEN ? AND ?
          $typeFilter $basketFilter $tagFilter
        GROUP BY dsd.agent_id, ds.source_basket
    ");
    $stmtReceived->execute(array_merge([$companyId, $startDate, $endDate], $filterParams));
    $receivedData = $stmtReceived->fetchAll(PDO::FETCH_ASSOC);

    // 4. Fetch Reclaimed (Pulled from Agents)
    // ds.distribution_mode = 'Bulk Reclaim'
    // dsd.agent_id is the agent it was reclaimed FROM.
    // dsd.previous_basket_key is the dashboard basket it was sitting in.
    $stmtReclaimed = $pdo->prepare("
        SELECT 
            dsd.agent_id,
            bc.basket_key as dash_basket,
            COUNT(dsd.id) as reclaimed_count
        FROM distribution_session_details dsd
        JOIN distribution_sessions ds ON dsd.session_id = ds.id
        LEFT JOIN basket_config bc ON (dsd.previous_basket_key = bc.basket_key OR dsd.previous_basket_key = bc.id)
        WHERE ds.company_id = ? 
          AND ds.distribution_mode = 'Bulk Reclaim'
          AND ds.session_status = 'completed'
          AND ds.created_at BETWEEN ? AND ?
          $typeFilter $basketFilter $tagFilter
        GROUP BY dsd.agent_id, bc.basket_key
    ");
    $stmtReclaimed->execute(array_merge([$companyId, $startDate, $endDate], $filterParams));
    $reclaimedData = $stmtReclaimed->fetchAll(PDO::FETCH_ASSOC);

    // 5. Build Pivot Matrix
    $matrix = [];
    foreach ($agents as $a) {
        $matrix[$a['agent_id']] = [
            'agent_id' => $a['agent_id'],
            'agent_name' => $a['agent_name'],
            'baskets' => [],
            'total_received' => 0,
            'total_reclaimed' => 0,
            'net' => 0
        ];
        
        // Initialize baskets
        foreach ($baskets as $b) {
            $matrix[$a['agent_id']]['baskets'][$b['basket_key']] = [
                'received' => 0,
                'reclaimed' => 0
            ];
        }
    }

    // Populate Received
    foreach ($receivedData as $row) {
        $agentId = $row['agent_id'];
        $poolBasket = $row['pool_basket'];
        $receivedCount = (int)$row['received_count'];
        
        // Map pool basket to dashboard basket
        $dashBasket = $poolToDashMap[$poolBasket] ?? $poolBasket;
        
        if (isset($matrix[$agentId])) {
            if (!isset($matrix[$agentId]['baskets'][$dashBasket])) {
                // In case it maps to an inactive/unknown dashboard basket, initialize it dynamically
                $matrix[$agentId]['baskets'][$dashBasket] = ['received' => 0, 'reclaimed' => 0];
            }
            $matrix[$agentId]['baskets'][$dashBasket]['received'] += $receivedCount;
            $matrix[$agentId]['total_received'] += $receivedCount;
            $matrix[$agentId]['net'] += $receivedCount;
        }
    }

    // Populate Reclaimed
    foreach ($reclaimedData as $row) {
        $agentId = $row['agent_id'];
        $dashBasket = $row['dash_basket'];
        $reclaimedCount = (int)$row['reclaimed_count'];
        
        if (isset($matrix[$agentId])) {
            if (!isset($matrix[$agentId]['baskets'][$dashBasket])) {
                $matrix[$agentId]['baskets'][$dashBasket] = ['received' => 0, 'reclaimed' => 0];
            }
            $matrix[$agentId]['baskets'][$dashBasket]['reclaimed'] += $reclaimedCount;
            $matrix[$agentId]['total_reclaimed'] += $reclaimedCount;
            $matrix[$agentId]['net'] -= $reclaimedCount;
        }
    }

    echo json_encode([
        'ok' => true,
        'baskets' => $baskets,
        'agents' => array_values($matrix)
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
    }

}
