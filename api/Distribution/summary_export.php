<?php
require_once __DIR__ . '/../config.php';
header('Content-Type: application/json; charset=utf-8');

$pdo = db_connect();

$companyId = $_GET['companyId'] ?? 1;
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
        // Find tag ID matching this name
        $stmtTag = $pdo->prepare("SELECT id FROM distribution_tags WHERE tag_name LIKE ? LIMIT 1");
        $stmtTag->execute(["%$sessionTag%"]);
        $tagRow = $stmtTag->fetch(PDO::FETCH_ASSOC);
        if ($tagRow) {
            $tagFilter = " AND ds.tag_id = ? ";
            $filterParams[] = $tagRow['id'];
        } else {
            // No tag match, guarantee empty result
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
            dsd.previous_basket_key as dash_basket,
            COUNT(dsd.id) as reclaimed_count
        FROM distribution_session_details dsd
        JOIN distribution_sessions ds ON dsd.session_id = ds.id
        WHERE ds.company_id = ? 
          AND ds.distribution_mode = 'Bulk Reclaim'
          AND ds.session_status = 'completed'
          AND ds.created_at BETWEEN ? AND ?
          $typeFilter $basketFilter $tagFilter
        GROUP BY dsd.agent_id, dsd.previous_basket_key
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
