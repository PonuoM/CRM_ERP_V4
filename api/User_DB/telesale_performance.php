<?php
/**
 * Telesale Performance Dashboard API - Phase 2
 * 
 * Metrics provided:
 * - Conversion Rate: Calls → Orders
 * - Retention Rate: Repeat customers %
 * - Active Rate (90 days): Customers still ordering
 * - AHT (Average Handling Time): Average call duration
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
    
    $companyId = $user['company_id'];
    $currentUserId = $user['id'];
    $currentUserRole = strtolower($user['role'] ?? '');
    
    // Role check - Admin or Supervisor only
    $isAdmin = strpos($currentUserRole, 'admin') !== false && strpos($currentUserRole, 'supervisor') === false;
    $isSupervisor = strpos($currentUserRole, 'supervisor') !== false;
    
    if (!$isAdmin && !$isSupervisor) {
        json_response(['success' => false, 'message' => 'Access denied. Admin or Supervisor only.'], 403);
        exit;
    }
    
    // Get parameters
    $year = isset($_GET['year']) ? intval($_GET['year']) : intval(date('Y'));
    $month = isset($_GET['month']) ? intval($_GET['month']) : intval(date('m'));
    
    // Build user filter for Supervisor
    $userFilter = "";
    $userParams = [];
    
    if ($isSupervisor && !$isAdmin) {
        // Supervisor sees only their team
        $userFilter = " AND u.supervisor_id = ?";
        $userParams = [$currentUserId];
    }
    
    // ========================================
    // 1. Get Call Data from onecall_log
    // ========================================
    $sqlCalls = "
        SELECT 
            u.id AS user_id,
            u.first_name,
            u.last_name,
            u.phone AS telesale_phone,
            COUNT(ol.id) AS total_calls,
            COALESCE(SUM(ol.duration), 0) / 60 AS total_minutes,
            ROUND(COALESCE(AVG(ol.duration), 0) / 60, 2) AS avg_duration_minutes
        FROM users u
        LEFT JOIN onecall_log ol ON ol.phone_telesale = u.phone
            AND YEAR(ol.timestamp) = ? AND MONTH(ol.timestamp) = ?
        WHERE u.company_id = ?
            AND u.role LIKE '%telesale%'
            AND u.status = 'active'
            $userFilter
        GROUP BY u.id, u.first_name, u.last_name, u.phone
    ";
    
    $callParams = array_merge([$year, $month, $companyId], $userParams);
    $stmt = $pdo->prepare($sqlCalls);
    $stmt->execute($callParams);
    $callData = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Index by user_id
    $callsByUser = [];
    foreach ($callData as $row) {
        $callsByUser[$row['user_id']] = $row;
    }
    
    // ========================================
    // 2. Get Order Data (Conversion)
    // ========================================
    $sqlOrders = "
        SELECT 
            u.id AS user_id,
            COUNT(DISTINCT o.id) AS total_orders,
            COALESCE(SUM(o.total_amount), 0) AS total_sales
        FROM users u
        LEFT JOIN orders o ON o.creator_id = u.id
            AND o.company_id = ?
            AND YEAR(o.order_date) = ? AND MONTH(o.order_date) = ?
            AND o.order_status NOT IN ('Cancelled')
        WHERE u.company_id = ?
            AND u.role LIKE '%telesale%'
            AND u.status = 'active'
            $userFilter
        GROUP BY u.id
    ";
    
    $orderParams = array_merge([$companyId, $year, $month, $companyId], $userParams);
    $stmt = $pdo->prepare($sqlOrders);
    $stmt->execute($orderParams);
    $orderData = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Index by user_id
    $ordersByUser = [];
    foreach ($orderData as $row) {
        $ordersByUser[$row['user_id']] = $row;
    }
    
    // ========================================
    // 3. Get Retention Data (Customers)
    // ========================================
    $sqlRetention = "
        SELECT 
            u.id AS user_id,
            COUNT(DISTINCT c.customer_id) AS total_customers,
            SUM(CASE WHEN c.is_repeat_customer = 1 THEN 1 ELSE 0 END) AS repeat_customers,
            SUM(CASE WHEN c.last_order_date >= DATE_SUB(NOW(), INTERVAL 90 DAY) THEN 1 ELSE 0 END) AS active_customers
        FROM users u
        LEFT JOIN customers c ON c.assigned_to = u.id 
            AND c.company_id = ?
            AND c.order_count >= 1
        WHERE u.company_id = ?
            AND u.role LIKE '%telesale%'
            AND u.status = 'active'
            $userFilter
        GROUP BY u.id
    ";
    
    $retentionParams = array_merge([$companyId, $companyId], $userParams);
    $stmt = $pdo->prepare($sqlRetention);
    $stmt->execute($retentionParams);
    $retentionData = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Index by user_id
    $retentionByUser = [];
    foreach ($retentionData as $row) {
        $retentionByUser[$row['user_id']] = $row;
    }
    
    // ========================================
    // 4. Combine All Data
    // ========================================
    $telesaleDetails = [];
    
    foreach ($callsByUser as $userId => $callInfo) {
        $orders = $ordersByUser[$userId] ?? ['total_orders' => 0, 'total_sales' => 0];
        $retention = $retentionByUser[$userId] ?? ['total_customers' => 0, 'repeat_customers' => 0, 'active_customers' => 0];
        
        $totalCalls = intval($callInfo['total_calls']);
        $totalOrders = intval($orders['total_orders']);
        $totalSales = floatval($orders['total_sales']);
        $totalMinutes = floatval($callInfo['total_minutes']);
        $avgDuration = floatval($callInfo['avg_duration_minutes']);
        
        $totalCustomers = intval($retention['total_customers']);
        $repeatCustomers = intval($retention['repeat_customers']);
        $activeCustomers = intval($retention['active_customers']);
        
        // Calculate rates
        $conversionRate = $totalCalls > 0 ? round(($totalOrders / $totalCalls) * 100, 2) : 0;
        $retentionRate = $totalCustomers > 0 ? round(($repeatCustomers / $totalCustomers) * 100, 2) : 0;
        $activeRate = $totalCustomers > 0 ? round(($activeCustomers / $totalCustomers) * 100, 2) : 0;
        $efficiencyScore = $totalMinutes > 0 ? round($totalSales / $totalMinutes, 2) : 0;
        
        $telesaleDetails[] = [
            'userId' => intval($userId),
            'name' => trim($callInfo['first_name'] . ' ' . $callInfo['last_name']),
            'firstName' => $callInfo['first_name'],
            'phone' => $callInfo['telesale_phone'],
            'metrics' => [
                'totalCalls' => $totalCalls,
                'totalOrders' => $totalOrders,
                'totalSales' => $totalSales,
                'conversionRate' => $conversionRate,
                'totalMinutes' => $totalMinutes,
                'ahtMinutes' => $avgDuration,
                'totalCustomers' => $totalCustomers,
                'repeatCustomers' => $repeatCustomers,
                'activeCustomers' => $activeCustomers,
                'retentionRate' => $retentionRate,
                'activeRate' => $activeRate,
                'efficiencyScore' => $efficiencyScore
            ]
        ];
    }
    
    // ========================================
    // 5. Calculate Team Averages
    // ========================================
    $totalTelesales = count($telesaleDetails);
    $teamAverages = [
        'conversionRate' => 0,
        'retentionRate' => 0,
        'activeRate' => 0,
        'ahtMinutes' => 0,
        'efficiencyScore' => 0,
        'totalCalls' => 0,
        'totalOrders' => 0,
        'totalSales' => 0
    ];
    
    if ($totalTelesales > 0) {
        $sumConversion = 0;
        $sumRetention = 0;
        $sumActive = 0;
        $sumAht = 0;
        $sumEfficiency = 0;
        $totalCalls = 0;
        $totalOrders = 0;
        $totalSales = 0;
        
        foreach ($telesaleDetails as $ts) {
            $sumConversion += $ts['metrics']['conversionRate'];
            $sumRetention += $ts['metrics']['retentionRate'];
            $sumActive += $ts['metrics']['activeRate'];
            $sumAht += $ts['metrics']['ahtMinutes'];
            $sumEfficiency += $ts['metrics']['efficiencyScore'];
            $totalCalls += $ts['metrics']['totalCalls'];
            $totalOrders += $ts['metrics']['totalOrders'];
            $totalSales += $ts['metrics']['totalSales'];
        }
        
        $teamAverages = [
            'conversionRate' => round($sumConversion / $totalTelesales, 2),
            'retentionRate' => round($sumRetention / $totalTelesales, 2),
            'activeRate' => round($sumActive / $totalTelesales, 2),
            'ahtMinutes' => round($sumAht / $totalTelesales, 2),
            'efficiencyScore' => round($sumEfficiency / $totalTelesales, 2),
            'totalCalls' => $totalCalls,
            'totalOrders' => $totalOrders,
            'totalSales' => $totalSales
        ];
    }
    
    // ========================================
    // 6. Create Rankings
    // ========================================
    // By Conversion Rate (desc)
    $byConversion = $telesaleDetails;
    usort($byConversion, function($a, $b) { return $b['metrics']['conversionRate'] <=> $a['metrics']['conversionRate']; });
    $byConversion = array_slice($byConversion, 0, 10);
    
    // By Retention Rate (desc)
    $byRetention = $telesaleDetails;
    usort($byRetention, function($a, $b) { return $b['metrics']['retentionRate'] <=> $a['metrics']['retentionRate']; });
    $byRetention = array_slice($byRetention, 0, 10);
    
    // By Active Rate (desc)
    $byActive = $telesaleDetails;
    usort($byActive, function($a, $b) { return $b['metrics']['activeRate'] <=> $a['metrics']['activeRate']; });
    $byActive = array_slice($byActive, 0, 10);
    
    // By Efficiency Score (desc) - High sales per minute
    $byEfficiency = $telesaleDetails;
    usort($byEfficiency, function($a, $b) { return $b['metrics']['efficiencyScore'] <=> $a['metrics']['efficiencyScore']; });
    $byEfficiency = array_slice($byEfficiency, 0, 10);
    
    // By AHT (asc) - Lower is better (but only those with calls)
    $byAht = array_filter($telesaleDetails, function($ts) { return $ts['metrics']['totalCalls'] > 0; });
    usort($byAht, function($a, $b) { return $a['metrics']['ahtMinutes'] <=> $b['metrics']['ahtMinutes']; });
    $byAht = array_slice($byAht, 0, 10);
    
    // ========================================
    // 7. Return Response
    // ========================================
    
    // Transform rankings for output
    $rankingsConversion = [];
    foreach ($byConversion as $ts) {
        $rankingsConversion[] = [
            'userId' => $ts['userId'],
            'name' => $ts['name'],
            'value' => $ts['metrics']['conversionRate'],
            'calls' => $ts['metrics']['totalCalls'],
            'orders' => $ts['metrics']['totalOrders']
        ];
    }
    
    $rankingsRetention = [];
    foreach ($byRetention as $ts) {
        $rankingsRetention[] = [
            'userId' => $ts['userId'],
            'name' => $ts['name'],
            'value' => $ts['metrics']['retentionRate'],
            'total' => $ts['metrics']['totalCustomers'],
            'repeat' => $ts['metrics']['repeatCustomers']
        ];
    }
    
    $rankingsActive = [];
    foreach ($byActive as $ts) {
        $rankingsActive[] = [
            'userId' => $ts['userId'],
            'name' => $ts['name'],
            'value' => $ts['metrics']['activeRate'],
            'total' => $ts['metrics']['totalCustomers'],
            'active' => $ts['metrics']['activeCustomers']
        ];
    }
    
    $rankingsEfficiency = [];
    foreach ($byEfficiency as $ts) {
        $rankingsEfficiency[] = [
            'userId' => $ts['userId'],
            'name' => $ts['name'],
            'value' => $ts['metrics']['efficiencyScore'],
            'sales' => $ts['metrics']['totalSales'],
            'minutes' => $ts['metrics']['totalMinutes']
        ];
    }
    
    $rankingsAht = [];
    foreach (array_values($byAht) as $ts) {
        $rankingsAht[] = [
            'userId' => $ts['userId'],
            'name' => $ts['name'],
            'value' => $ts['metrics']['ahtMinutes'],
            'calls' => $ts['metrics']['totalCalls']
        ];
    }
    
    json_response([
        'success' => true,
        'data' => [
            'period' => [
                'year' => $year,
                'month' => $month
            ],
            'teamAverages' => $teamAverages,
            'telesaleCount' => $totalTelesales,
            'rankings' => [
                'byConversion' => $rankingsConversion,
                'byRetention' => $rankingsRetention,
                'byActive' => $rankingsActive,
                'byEfficiency' => $rankingsEfficiency,
                'byAht' => $rankingsAht
            ],
            'telesaleDetails' => $telesaleDetails,
            '_debug' => [
                'role' => $currentUserRole,
                'isAdmin' => $isAdmin,
                'isSupervisor' => $isSupervisor
            ]
        ]
    ]);
    
} catch (Exception $e) {
    json_response([
        'success' => false,
        'message' => 'Server error: ' . $e->getMessage()
    ], 500);
}
