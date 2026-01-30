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
    // TIER DEFINITIONS (Basket Keys)
    // ========================================
    // Tier 1: Core Portfolio (Main Income - customers that must be retained)
    $TIER_CORE_KEYS = [39, 40];  // personal_1_2m, personal_last_chance
    
    // Tier 2: Revival/Graveyard (Dormant customers - hard to convert)
    $TIER_REVIVAL_KEYS = [43, 44, 45];  // mid_6_12m, mid_1_3y, ancient
    
    // Tier 3: New & Onboarding (New leads and fresh customers)
    $TIER_NEW_KEYS = [38, 41];  // new_customer, find_new_owner
    
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
    // 2. Get Order Data (Conversion) - Using order_items.creator_id
    //    This ensures sales are attributed to the actual seller,
    //    even when multiple telesales contribute to one order (พ่วง)
    // ========================================
    $sqlOrders = "
        SELECT 
            u.id AS user_id,
            COUNT(DISTINCT oi.parent_order_id) AS total_orders,
            COALESCE(SUM(oi.quantity * oi.price_per_unit), 0) AS total_sales
        FROM users u
        LEFT JOIN order_items oi ON oi.creator_id = u.id
        LEFT JOIN orders o ON oi.parent_order_id = o.id
            AND o.company_id = ?
            AND YEAR(o.order_date) = ? AND MONTH(o.order_date) = ?
            AND o.order_status NOT IN ('Cancelled')
        WHERE u.company_id = ?
            AND u.role LIKE '%telesale%'
            AND u.status = 'active'
            AND (oi.is_freebie = 0 OR oi.is_freebie IS NULL)
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
    // 3. Get Retention Data (Customers) - Using order_items.creator_id
    //    Loyalty = customers who bought from THIS telesale more than once
    //    (not just any repeat customer in the system)
    // ========================================
    $sqlRetention = "
        SELECT 
            u.id AS user_id,
            COUNT(DISTINCT c.customer_id) AS total_customers,
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
    // 3a. Get Loyalty Data (Customers who bought from THIS telesale >1 times)
    //     Based on order_items.creator_id, not is_repeat_customer flag
    // ========================================
    $sqlLoyalty = "
        SELECT 
            u.id AS user_id,
            COUNT(DISTINCT loyal.customer_id) AS repeat_customers
        FROM users u
        LEFT JOIN (
            SELECT 
                oi.creator_id,
                o.customer_id,
                COUNT(DISTINCT o.id) AS orders_from_this_telesale
            FROM order_items oi
            JOIN orders o ON oi.parent_order_id = o.id
            WHERE o.company_id = ?
                AND o.order_status NOT IN ('Cancelled')
                AND (oi.is_freebie = 0 OR oi.is_freebie IS NULL)
            GROUP BY oi.creator_id, o.customer_id
            HAVING COUNT(DISTINCT o.id) > 1
        ) AS loyal ON loyal.creator_id = u.id
        WHERE u.company_id = ?
            AND u.role LIKE '%telesale%'
            AND u.status = 'active'
            $userFilter
        GROUP BY u.id
    ";
    
    $loyaltyParams = array_merge([$companyId, $companyId], $userParams);
    $stmt = $pdo->prepare($sqlLoyalty);
    $stmt->execute($loyaltyParams);
    $loyaltyData = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Index by user_id and merge into retentionByUser
    foreach ($loyaltyData as $row) {
        if (isset($retentionByUser[$row['user_id']])) {
            $retentionByUser[$row['user_id']]['repeat_customers'] = $row['repeat_customers'];
        } else {
            $retentionByUser[$row['user_id']] = [
                'user_id' => $row['user_id'],
                'total_customers' => 0,
                'active_customers' => 0,
                'repeat_customers' => $row['repeat_customers']
            ];
        }
    }
    
    // Ensure all users have repeat_customers key
    foreach ($retentionByUser as $userId => &$data) {
        if (!isset($data['repeat_customers'])) {
            $data['repeat_customers'] = 0;
        }
    }
    unset($data);
    
    // ========================================
    // 3b. TIER-SPECIFIC METRICS (Based on basket_key_at_sale from order_items)
    //     This ensures accurate month-by-month tracking
    // ========================================
    
    // Helper: Convert basket keys array to SQL IN clause
    $coreKeysIn = implode(',', $TIER_CORE_KEYS);
    $revivalKeysIn = implode(',', $TIER_REVIVAL_KEYS);
    $newKeysIn = implode(',', $TIER_NEW_KEYS);
    
    // TIER 1: Core Portfolio Metrics (Orders from Core basket during this month)
    // Uses basket_key_at_sale to track what basket customer was in when order was placed
    $sqlTierCore = "
        SELECT 
            u.id AS user_id,
            COUNT(DISTINCT CASE WHEN oi.basket_key_at_sale IN ($coreKeysIn) THEN o.customer_id END) AS core_total,
            COUNT(DISTINCT CASE WHEN oi.basket_key_at_sale IN ($coreKeysIn) AND o.order_status NOT IN ('Cancelled') THEN o.customer_id END) AS core_active,
            COUNT(DISTINCT CASE 
                WHEN oi.basket_key_at_sale IN ($coreKeysIn) 
                AND (SELECT COUNT(*) FROM orders o2 
                     JOIN order_items oi2 ON oi2.parent_order_id = o2.id 
                     WHERE oi2.creator_id = u.id AND o2.customer_id = o.customer_id 
                     AND o2.order_status NOT IN ('Cancelled')) > 1 
                THEN o.customer_id 
            END) AS core_loyal
        FROM users u
        LEFT JOIN order_items oi ON oi.creator_id = u.id
            AND (oi.is_freebie = 0 OR oi.is_freebie IS NULL)
        LEFT JOIN orders o ON oi.parent_order_id = o.id
            AND o.company_id = ?
            AND YEAR(o.order_date) = ? AND MONTH(o.order_date) = ?
            AND o.order_status NOT IN ('Cancelled')
        WHERE u.company_id = ?
            AND u.role LIKE '%telesale%'
            AND u.status = 'active'
            $userFilter
        GROUP BY u.id
    ";
    $tierCoreParams = array_merge([$companyId, $year, $month, $companyId], $userParams);
    $stmt = $pdo->prepare($sqlTierCore);
    $stmt->execute($tierCoreParams);
    $tierCoreByUser = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $tierCoreByUser[$row['user_id']] = $row;
    }
    
    // TIER 2: Revival Metrics (Orders from Revival basket during this month)
    $sqlTierRevival = "
        SELECT 
            u.id AS user_id,
            COUNT(DISTINCT CASE WHEN oi.basket_key_at_sale IN ($revivalKeysIn) THEN o.customer_id END) AS revival_total,
            COUNT(DISTINCT CASE WHEN oi.basket_key_at_sale IN ($revivalKeysIn) AND o.order_status NOT IN ('Cancelled') THEN o.customer_id END) AS revival_count
        FROM users u
        LEFT JOIN order_items oi ON oi.creator_id = u.id
            AND (oi.is_freebie = 0 OR oi.is_freebie IS NULL)
        LEFT JOIN orders o ON oi.parent_order_id = o.id
            AND o.company_id = ?
            AND YEAR(o.order_date) = ? AND MONTH(o.order_date) = ?
            AND o.order_status NOT IN ('Cancelled')
        WHERE u.company_id = ?
            AND u.role LIKE '%telesale%'
            AND u.status = 'active'
            $userFilter
        GROUP BY u.id
    ";
    $tierRevivalParams = array_merge([$companyId, $year, $month, $companyId], $userParams);
    $stmt = $pdo->prepare($sqlTierRevival);
    $stmt->execute($tierRevivalParams);
    $tierRevivalByUser = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $tierRevivalByUser[$row['user_id']] = $row;
    }
    
    // TIER 3: New Customer Metrics (Orders from New basket during this month)
    $sqlTierNew = "
        SELECT 
            u.id AS user_id,
            COUNT(DISTINCT CASE WHEN oi.basket_key_at_sale IN ($newKeysIn) THEN o.customer_id END) AS new_total,
            COUNT(DISTINCT CASE WHEN oi.basket_key_at_sale IN ($newKeysIn) AND o.order_status NOT IN ('Cancelled') THEN o.customer_id END) AS new_converted
        FROM users u
        LEFT JOIN order_items oi ON oi.creator_id = u.id
            AND (oi.is_freebie = 0 OR oi.is_freebie IS NULL)
        LEFT JOIN orders o ON oi.parent_order_id = o.id
            AND o.company_id = ?
            AND YEAR(o.order_date) = ? AND MONTH(o.order_date) = ?
            AND o.order_status NOT IN ('Cancelled')
        WHERE u.company_id = ?
            AND u.role LIKE '%telesale%'
            AND u.status = 'active'
            $userFilter
        GROUP BY u.id
    ";
    $tierNewParams = array_merge([$companyId, $year, $month, $companyId], $userParams);
    $stmt = $pdo->prepare($sqlTierNew);
    $stmt->execute($tierNewParams);
    $tierNewByUser = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $tierNewByUser[$row['user_id']] = $row;
    }
    
    // ========================================
    // 4. Combine All Data
    // ========================================
    $telesaleDetails = [];
    
    foreach ($callsByUser as $userId => $callInfo) {
        $orders = $ordersByUser[$userId] ?? ['total_orders' => 0, 'total_sales' => 0];
        $retention = $retentionByUser[$userId] ?? ['total_customers' => 0, 'repeat_customers' => 0, 'active_customers' => 0];
        
        // Tier data
        $tierCore = $tierCoreByUser[$userId] ?? ['core_total' => 0, 'core_active' => 0, 'core_loyal' => 0];
        $tierRevival = $tierRevivalByUser[$userId] ?? ['revival_total' => 0, 'revival_count' => 0];
        $tierNew = $tierNewByUser[$userId] ?? ['new_total' => 0, 'new_converted' => 0];
        
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
        
        // Tier-specific rates
        $coreTotal = intval($tierCore['core_total']);
        $coreActive = intval($tierCore['core_active']);
        $coreLoyal = intval($tierCore['core_loyal']);
        $coreActiveRate = $coreTotal > 0 ? round(($coreActive / $coreTotal) * 100, 2) : 0;
        $coreLoyaltyRate = $coreTotal > 0 ? round(($coreLoyal / $coreTotal) * 100, 2) : 0;
        
        $revivalTotal = intval($tierRevival['revival_total']);
        $revivalCount = intval($tierRevival['revival_count']);
        
        $newTotal = intval($tierNew['new_total']);
        $newConverted = intval($tierNew['new_converted']);
        $newConversionRate = $newTotal > 0 ? round(($newConverted / $newTotal) * 100, 2) : 0;
        
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
            ],
            'tierMetrics' => [
                'core' => [
                    'total' => $coreTotal,
                    'active' => $coreActive,
                    'loyal' => $coreLoyal,
                    'activeRate' => $coreActiveRate,
                    'loyaltyRate' => $coreLoyaltyRate
                ],
                'revival' => [
                    'total' => $revivalTotal,
                    'revived' => $revivalCount
                ],
                'new' => [
                    'total' => $newTotal,
                    'converted' => $newConverted,
                    'conversionRate' => $newConversionRate
                ]
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
    
    // Tier aggregates
    $tierAggregates = [
        'core' => ['total' => 0, 'active' => 0, 'loyal' => 0, 'activeRate' => 0, 'loyaltyRate' => 0],
        'revival' => ['total' => 0, 'revived' => 0],
        'new' => ['total' => 0, 'converted' => 0, 'conversionRate' => 0]
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
        
        // Tier sums
        $coreTotalSum = 0; $coreActiveSum = 0; $coreLoyalSum = 0;
        $revivalTotalSum = 0; $revivalCount = 0;
        $newTotalSum = 0; $newConvertedSum = 0;
        
        foreach ($telesaleDetails as $ts) {
            $sumConversion += $ts['metrics']['conversionRate'];
            $sumRetention += $ts['metrics']['retentionRate'];
            $sumActive += $ts['metrics']['activeRate'];
            $sumAht += $ts['metrics']['ahtMinutes'];
            $sumEfficiency += $ts['metrics']['efficiencyScore'];
            $totalCalls += $ts['metrics']['totalCalls'];
            $totalOrders += $ts['metrics']['totalOrders'];
            $totalSales += $ts['metrics']['totalSales'];
            
            // Tier sums
            $coreTotalSum += $ts['tierMetrics']['core']['total'];
            $coreActiveSum += $ts['tierMetrics']['core']['active'];
            $coreLoyalSum += $ts['tierMetrics']['core']['loyal'];
            $revivalTotalSum += $ts['tierMetrics']['revival']['total'];
            $revivalCount += $ts['tierMetrics']['revival']['revived'];
            $newTotalSum += $ts['tierMetrics']['new']['total'];
            $newConvertedSum += $ts['tierMetrics']['new']['converted'];
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
        
        // Tier aggregates
        $tierAggregates = [
            'core' => [
                'total' => $coreTotalSum,
                'active' => $coreActiveSum,
                'loyal' => $coreLoyalSum,
                'activeRate' => $coreTotalSum > 0 ? round(($coreActiveSum / $coreTotalSum) * 100, 2) : 0,
                'loyaltyRate' => $coreTotalSum > 0 ? round(($coreLoyalSum / $coreTotalSum) * 100, 2) : 0
            ],
            'revival' => [
                'total' => $revivalTotalSum,
                'revived' => $revivalCount
            ],
            'new' => [
                'total' => $newTotalSum,
                'converted' => $newConvertedSum,
                'conversionRate' => $newTotalSum > 0 ? round(($newConvertedSum / $newTotalSum) * 100, 2) : 0
            ]
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
    
    // Revival ranking (by revival count desc)
    $byRevival = $telesaleDetails;
    usort($byRevival, function($a, $b) { 
        return $b['tierMetrics']['revival']['revived'] <=> $a['tierMetrics']['revival']['revived']; 
    });
    $byRevival = array_slice($byRevival, 0, 10);
    
    $rankingsRevival = [];
    foreach ($byRevival as $ts) {
        if ($ts['tierMetrics']['revival']['revived'] > 0) {
            $rankingsRevival[] = [
                'userId' => $ts['userId'],
                'name' => $ts['name'],
                'value' => $ts['tierMetrics']['revival']['revived'],
                'total' => $ts['tierMetrics']['revival']['total']
            ];
        }
    }
    
    json_response([
        'success' => true,
        'data' => [
            'period' => [
                'year' => $year,
                'month' => $month
            ],
            'teamAverages' => $teamAverages,
            'tierAggregates' => $tierAggregates,
            'telesaleCount' => $totalTelesales,
            'rankings' => [
                'byConversion' => $rankingsConversion,
                'byRetention' => $rankingsRetention,
                'byActive' => $rankingsActive,
                'byEfficiency' => $rankingsEfficiency,
                'byAht' => $rankingsAht,
                'byRevival' => $rankingsRevival
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
