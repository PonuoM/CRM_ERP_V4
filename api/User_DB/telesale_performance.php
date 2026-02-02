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
    //    This includes BOTH regular sales AND upsell items
    //    - Regular sale: o.creator_id = user, oi.creator_id = user
    //    - Upsell: o.creator_id = other_user, oi.creator_id = user
    // ========================================
    $sqlOrders = "
        SELECT 
            oi.creator_id AS user_id,
            COUNT(DISTINCT o.id) AS total_orders,
            COALESCE(SUM(COALESCE(oi.net_total, oi.quantity * oi.price_per_unit)), 0) AS total_sales
        FROM order_items oi
        JOIN orders o ON oi.parent_order_id = o.id
        JOIN users u ON oi.creator_id = u.id
        WHERE o.company_id = ?
            AND YEAR(o.order_date) = ? AND MONTH(o.order_date) = ?
            AND o.order_status NOT IN ('Cancelled', 'Returned', 'BadDebt')
            AND (oi.is_freebie = 0 OR oi.is_freebie IS NULL)
            AND u.company_id = ?
            AND u.role LIKE '%telesale%'
            AND u.status = 'active'
            $userFilter
        GROUP BY oi.creator_id
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
    // 2a. Get Sales Targets for this month
    // ========================================
    $sqlTargets = "
        SELECT user_id, target_amount
        FROM sales_targets
        WHERE month = ? AND year = ?
    ";
    
    $stmt = $pdo->prepare($sqlTargets);
    $stmt->execute([$month, $year]);
    $targetData = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    $targetsByUser = [];
    foreach ($targetData as $row) {
        $targetsByUser[$row['user_id']] = floatval($row['target_amount']);
    }
    
    // ========================================
    // 2b. Get Upsell Data - Items added by this user to orders created by OTHER users
    //     This is separate from regular sales to show upsell contribution
    // ========================================
    $sqlUpsell = "
        SELECT 
            oi.creator_id AS user_id,
            COUNT(DISTINCT o.id) AS upsell_orders,
            COALESCE(SUM(COALESCE(oi.net_total, oi.quantity * oi.price_per_unit)), 0) AS upsell_sales,
            COALESCE(SUM(oi.quantity), 0) AS upsell_quantity
        FROM order_items oi
        JOIN orders o ON oi.parent_order_id = o.id
        JOIN users u ON oi.creator_id = u.id
        WHERE o.company_id = ?
            AND YEAR(o.order_date) = ? AND MONTH(o.order_date) = ?
            AND o.order_status NOT IN ('Cancelled', 'Returned', 'BadDebt')
            AND (oi.is_freebie = 0 OR oi.is_freebie IS NULL)
            AND o.creator_id != oi.creator_id  -- Key: Order was created by someone else
            AND u.company_id = ?
            AND u.role LIKE '%telesale%'
            AND u.status = 'active'
            $userFilter
        GROUP BY oi.creator_id
    ";
    
    $upsellParams = array_merge([$companyId, $year, $month, $companyId], $userParams);
    $stmt = $pdo->prepare($sqlUpsell);
    $stmt->execute($upsellParams);
    $upsellData = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Index by user_id
    $upsellByUser = [];
    foreach ($upsellData as $row) {
        $upsellByUser[$row['user_id']] = $row;
    }
    
    // ========================================
    // 3. NEW METRICS: AOV, New Customers, Win-back, Retention (all month-based)
    //    Using oi.creator_id to include upsell
    // ========================================
    
    // 3a. AOV (Average Order Value) - ยอดเฉลี่ยต่อออเดอร์ (รวม upsell)
    $sqlAOV = "
        SELECT 
            oi.creator_id AS user_id,
            COALESCE(SUM(COALESCE(oi.net_total, oi.quantity * oi.price_per_unit)) / 
                NULLIF(COUNT(DISTINCT o.id), 0), 0) AS aov
        FROM order_items oi
        JOIN orders o ON oi.parent_order_id = o.id
        JOIN users u ON oi.creator_id = u.id
        WHERE o.company_id = ?
            AND YEAR(o.order_date) = ? AND MONTH(o.order_date) = ?
            AND o.order_status NOT IN ('Cancelled', 'Returned', 'BadDebt')
            AND (oi.is_freebie = 0 OR oi.is_freebie IS NULL)
            AND u.company_id = ?
            AND u.role LIKE '%telesale%'
            AND u.status = 'active'
            $userFilter
        GROUP BY oi.creator_id
    ";
    
    $aovParams = array_merge([$companyId, $year, $month, $companyId], $userParams);
    $stmt = $pdo->prepare($sqlAOV);
    $stmt->execute($aovParams);
    $aovData = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    $aovByUser = [];
    foreach ($aovData as $row) {
        $aovByUser[$row['user_id']] = $row;
    }
    
    // 3b. New Customers - ลูกค้าใหม่ในเดือนนี้ (จาก orders.customer_type)
    $sqlNewCustomers = "
        SELECT 
            oi.creator_id AS user_id,
            COUNT(DISTINCT CASE WHEN o.customer_type = 'New Customer' THEN o.customer_id END) AS new_customers,
            COUNT(DISTINCT o.customer_id) AS total_customers_month
        FROM order_items oi
        JOIN orders o ON oi.parent_order_id = o.id
        JOIN users u ON oi.creator_id = u.id
        WHERE o.company_id = ?
            AND YEAR(o.order_date) = ? AND MONTH(o.order_date) = ?
            AND o.order_status NOT IN ('Cancelled', 'Returned', 'BadDebt')
            AND (oi.is_freebie = 0 OR oi.is_freebie IS NULL)
            AND u.company_id = ?
            AND u.role LIKE '%telesale%'
            AND u.status = 'active'
            $userFilter
        GROUP BY oi.creator_id
    ";
    
    $newCustParams = array_merge([$companyId, $year, $month, $companyId], $userParams);
    $stmt = $pdo->prepare($sqlNewCustomers);
    $stmt->execute($newCustParams);
    $newCustData = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    $newCustByUser = [];
    foreach ($newCustData as $row) {
        $newCustByUser[$row['user_id']] = $row;
    }
    
    // 3c. Win-back - ลูกค้าเก่าที่กลับมา (basket_key_at_sale IN 48,49,50)
    //     Basket 48 = ถังกลาง 6-12 เดือน
    //     Basket 49 = ถังกลาง 1-3 ปี  
    //     Basket 50 = ถังโบราณ เก่าเก็บ >3 ปี
    $sqlWinback = "
        SELECT 
            oi.creator_id AS user_id,
            COUNT(DISTINCT CASE 
                WHEN COALESCE(oi.basket_key_at_sale, o.basket_key_at_sale) IN ('48', '49', '50') 
                THEN o.customer_id 
            END) AS winback_customers,
            COUNT(DISTINCT o.id) AS total_orders_month
        FROM order_items oi
        JOIN orders o ON oi.parent_order_id = o.id
        JOIN users u ON oi.creator_id = u.id
        WHERE o.company_id = ?
            AND YEAR(o.order_date) = ? AND MONTH(o.order_date) = ?
            AND o.order_status NOT IN ('Cancelled', 'Returned', 'BadDebt')
            AND (oi.is_freebie = 0 OR oi.is_freebie IS NULL)
            AND u.company_id = ?
            AND u.role LIKE '%telesale%'
            AND u.status = 'active'
            $userFilter
        GROUP BY oi.creator_id
    ";
    
    $winbackParams = array_merge([$companyId, $year, $month, $companyId], $userParams);
    $stmt = $pdo->prepare($sqlWinback);
    $stmt->execute($winbackParams);
    $winbackData = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    $winbackByUser = [];
    foreach ($winbackData as $row) {
        $winbackByUser[$row['user_id']] = $row;
    }
    
    // 3d. Retention - ลูกค้าซื้อซ้ำ (Basket-Based)
    //     ลูกค้าใน basket 39,40 ของ Telesale = ลูกค้าที่อยู่ในช่วง 90 วันหลังขายได้
    //     ซื้อซ้ำ = ลูกค้าใน basket 39,40 ที่มีออเดอร์ในเดือนนี้
    
    // Step 1: นับลูกค้าทั้งหมดใน basket 39,40 ของแต่ละ Telesale
    $sqlBasketTotal = "
        SELECT 
            c.assigned_to AS user_id,
            COUNT(*) AS total_customers_basket
        FROM customers c
        JOIN users u ON c.assigned_to = u.id
        WHERE c.current_basket_key IN ('39', '40')
            AND c.company_id = ?
            AND u.company_id = ?
            AND u.role LIKE '%telesale%'
            AND u.status = 'active'
            $userFilter
        GROUP BY c.assigned_to
    ";
    
    $basketTotalParams = array_merge([$companyId, $companyId], $userParams);
    $stmt = $pdo->prepare($sqlBasketTotal);
    $stmt->execute($basketTotalParams);
    $basketTotalData = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    $basketTotalByUser = [];
    foreach ($basketTotalData as $row) {
        $basketTotalByUser[$row['user_id']] = $row;
    }
    
    // Step 2: นับลูกค้าใน basket 39,40 ที่ซื้อในเดือนนี้ (= ซื้อซ้ำ)
    $sqlRetention = "
        SELECT 
            c.assigned_to AS user_id,
            COUNT(DISTINCT o.customer_id) AS repeat_customers
        FROM customers c
        JOIN orders o ON c.customer_id = o.customer_id
        JOIN users u ON c.assigned_to = u.id
        WHERE c.current_basket_key IN ('39', '40')
            AND c.company_id = ?
            AND o.company_id = ?
            AND YEAR(o.order_date) = ? AND MONTH(o.order_date) = ?
            AND o.order_status NOT IN ('Cancelled', 'Returned', 'BadDebt')
            AND u.company_id = ?
            AND u.role LIKE '%telesale%'
            AND u.status = 'active'
            $userFilter
        GROUP BY c.assigned_to
    ";
    
    $retentionParams = array_merge([$companyId, $companyId, $year, $month, $companyId], $userParams);
    $stmt = $pdo->prepare($sqlRetention);
    $stmt->execute($retentionParams);
    $retentionData = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    $retentionByUser = [];
    foreach ($retentionData as $row) {
        $userId = $row['user_id'];
        $totalInBasket = $basketTotalByUser[$userId]['total_customers_basket'] ?? 0;
        $retentionByUser[$userId] = [
            'repeat_customers' => $row['repeat_customers'],
            'total_customers' => $totalInBasket
        ];
    }
    
    // Fill in users who have customers in basket but no orders this month
    foreach ($basketTotalByUser as $userId => $data) {
        if (!isset($retentionByUser[$userId])) {
            $retentionByUser[$userId] = [
                'repeat_customers' => 0,
                'total_customers' => $data['total_customers_basket']
            ];
        }
    }

    
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
            COUNT(DISTINCT CASE WHEN oi.basket_key_at_sale IN ($coreKeysIn) AND o.order_status NOT IN ('Cancelled', 'Returned', 'BadDebt') THEN o.customer_id END) AS core_active,
            COUNT(DISTINCT CASE 
                WHEN oi.basket_key_at_sale IN ($coreKeysIn) 
                AND (SELECT COUNT(*) FROM orders o2 
                     JOIN order_items oi2 ON oi2.parent_order_id = o2.id 
                     WHERE oi2.creator_id = u.id AND o2.customer_id = o.customer_id 
                     AND o2.order_status NOT IN ('Cancelled', 'Returned', 'BadDebt')) > 1 
                THEN o.customer_id 
            END) AS core_loyal
        FROM users u
        LEFT JOIN order_items oi ON oi.creator_id = u.id
            AND (oi.is_freebie = 0 OR oi.is_freebie IS NULL)
        LEFT JOIN orders o ON oi.parent_order_id = o.id
            AND o.company_id = ?
            AND YEAR(o.order_date) = ? AND MONTH(o.order_date) = ?
            AND o.order_status NOT IN ('Cancelled', 'Returned', 'BadDebt')
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
            COUNT(DISTINCT CASE WHEN oi.basket_key_at_sale IN ($revivalKeysIn) AND o.order_status NOT IN ('Cancelled', 'Returned', 'BadDebt') THEN o.customer_id END) AS revival_count
        FROM users u
        LEFT JOIN order_items oi ON oi.creator_id = u.id
            AND (oi.is_freebie = 0 OR oi.is_freebie IS NULL)
        LEFT JOIN orders o ON oi.parent_order_id = o.id
            AND o.company_id = ?
            AND YEAR(o.order_date) = ? AND MONTH(o.order_date) = ?
            AND o.order_status NOT IN ('Cancelled', 'Returned', 'BadDebt')
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
            COUNT(DISTINCT CASE WHEN oi.basket_key_at_sale IN ($newKeysIn) AND o.order_status NOT IN ('Cancelled', 'Returned', 'BadDebt') THEN o.customer_id END) AS new_converted
        FROM users u
        LEFT JOIN order_items oi ON oi.creator_id = u.id
            AND (oi.is_freebie = 0 OR oi.is_freebie IS NULL)
        LEFT JOIN orders o ON oi.parent_order_id = o.id
            AND o.company_id = ?
            AND YEAR(o.order_date) = ? AND MONTH(o.order_date) = ?
            AND o.order_status NOT IN ('Cancelled', 'Returned', 'BadDebt')
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
        $retention = $retentionByUser[$userId] ?? ['total_customers' => 0, 'repeat_customers' => 0];
        $upsell = $upsellByUser[$userId] ?? ['upsell_orders' => 0, 'upsell_sales' => 0, 'upsell_quantity' => 0];
        
        // NEW: Get data from new metrics queries
        $aovData = $aovByUser[$userId] ?? ['aov' => 0];
        $newCustData = $newCustByUser[$userId] ?? ['new_customers' => 0, 'total_customers_month' => 0];
        $winbackData = $winbackByUser[$userId] ?? ['winback_customers' => 0, 'total_orders_month' => 0];
        
        // Tier data
        $tierCore = $tierCoreByUser[$userId] ?? ['core_total' => 0, 'core_active' => 0, 'core_loyal' => 0];
        $tierRevival = $tierRevivalByUser[$userId] ?? ['revival_total' => 0, 'revival_count' => 0];
        $tierNew = $tierNewByUser[$userId] ?? ['new_total' => 0, 'new_converted' => 0];
        
        $totalCalls = intval($callInfo['total_calls']);
        $totalOrders = intval($orders['total_orders']);
        $totalSales = floatval($orders['total_sales']);
        $totalMinutes = floatval($callInfo['total_minutes']);
        $avgDuration = floatval($callInfo['avg_duration_minutes']);
        
        // Upsell metrics (items added to other users' orders)
        $upsellOrders = intval($upsell['upsell_orders']);
        $upsellSales = floatval($upsell['upsell_sales']);
        $upsellQuantity = intval($upsell['upsell_quantity']);
        
        // NEW METRICS from month-based queries
        $totalCustomers = intval($retention['total_customers']);
        $repeatCustomers = intval($retention['repeat_customers']);
        $aov = floatval($aovData['aov']);
        $newCustomers = intval($newCustData['new_customers']);
        $totalCustomersMonth = intval($newCustData['total_customers_month']);
        $winbackCustomers = intval($winbackData['winback_customers']);
        
        // Calculate rates
        // Include upsell in efficiency calculation
        $combinedSales = $totalSales + $upsellSales;
        $conversionRate = $totalCalls > 0 ? round(($totalOrders / $totalCalls) * 100, 2) : 0;
        $retentionRate = $totalCustomers > 0 ? round(($repeatCustomers / $totalCustomers) * 100, 2) : 0;
        $newCustomerRate = $totalCustomersMonth > 0 ? round(($newCustomers / $totalCustomersMonth) * 100, 2) : 0;
        $efficiencyScore = $totalMinutes > 0 ? round($combinedSales / $totalMinutes, 2) : 0;
        
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
                'totalSales' => $totalSales,  // ยอดขายปกติ (ไม่รวม upsell เพราะแสดงแยกคอลัมน์)
                'conversionRate' => $conversionRate,
                'totalMinutes' => $totalMinutes,
                'ahtMinutes' => $avgDuration,
                'totalCustomers' => $totalCustomers,
                'repeatCustomers' => $repeatCustomers,
                'retentionRate' => $retentionRate,
                // NEW METRICS
                'aov' => $aov,                        // ยอดเฉลี่ยต่อออเดอร์
                'newCustomers' => $newCustomers,      // ลูกค้าใหม่ในเดือนนี้
                'newCustomerRate' => $newCustomerRate, // อัตราลูกค้าใหม่ %
                'winbackCustomers' => $winbackCustomers, // ลูกค้าเก่าที่กลับมา
                'efficiencyScore' => $efficiencyScore,
                'combinedSales' => $combinedSales,  // ยอดขายรวม upsell สำหรับประสิทธิภาพ
                // Upsell: Sales from items added to OTHER users' orders
                'upsellOrders' => $upsellOrders,
                'upsellSales' => $upsellSales,
                'upsellQuantity' => $upsellQuantity,
                // Target: Monthly sales target
                'targetAmount' => $targetsByUser[$userId] ?? 0,
                'targetProgress' => ($targetsByUser[$userId] ?? 0) > 0 
                    ? round(($combinedSales / $targetsByUser[$userId]) * 100, 1) 
                    : 0
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
        'aov' => 0,
        'newCustomerRate' => 0,
        'ahtMinutes' => 0,
        'efficiencyScore' => 0,
        'totalCalls' => 0,
        'totalOrders' => 0,
        'totalSales' => 0,
        'newCustomers' => 0,
        'winbackCustomers' => 0
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
        $sumAov = 0;
        $sumNewCustomerRate = 0;
        $sumAht = 0;
        $sumEfficiency = 0;
        $totalCalls = 0;
        $totalOrders = 0;
        $totalSales = 0;
        $totalNewCustomers = 0;
        $totalWinbackCustomers = 0;
        
        // Tier sums
        $coreTotalSum = 0; $coreActiveSum = 0; $coreLoyalSum = 0;
        $revivalTotalSum = 0; $revivalCount = 0;
        $newTotalSum = 0; $newConvertedSum = 0;
        
        foreach ($telesaleDetails as $ts) {
            $sumConversion += $ts['metrics']['conversionRate'];
            $sumRetention += $ts['metrics']['retentionRate'];
            $sumAov += $ts['metrics']['aov'];
            $sumNewCustomerRate += $ts['metrics']['newCustomerRate'];
            $sumAht += $ts['metrics']['ahtMinutes'];
            $sumEfficiency += $ts['metrics']['efficiencyScore'];
            $totalCalls += $ts['metrics']['totalCalls'];
            $totalOrders += $ts['metrics']['totalOrders'];
            $totalSales += $ts['metrics']['totalSales'];
            $totalNewCustomers += $ts['metrics']['newCustomers'];
            $totalWinbackCustomers += $ts['metrics']['winbackCustomers'];
            
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
            'aov' => round($sumAov / $totalTelesales, 2),
            'newCustomerRate' => round($sumNewCustomerRate / $totalTelesales, 2),
            'ahtMinutes' => round($sumAht / $totalTelesales, 2),
            'efficiencyScore' => round($sumEfficiency / $totalTelesales, 2),
            'totalCalls' => $totalCalls,
            'totalOrders' => $totalOrders,
            'totalSales' => $totalSales,
            'newCustomers' => $totalNewCustomers,
            'winbackCustomers' => $totalWinbackCustomers
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
    
    // By Active Rate (desc) - REPLACED WITH AOV
    $byAov = $telesaleDetails;
    usort($byAov, function($a, $b) { return $b['metrics']['aov'] <=> $a['metrics']['aov']; });
    $byAov = array_slice($byAov, 0, 10);
    
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
    
    // REPLACED: Active Rate → AOV (Average Order Value)
    $rankingsAov = [];
    foreach ($byAov as $ts) {
        $rankingsAov[] = [
            'userId' => $ts['userId'],
            'name' => $ts['name'],
            'value' => $ts['metrics']['aov'],
            'sales' => $ts['metrics']['combinedSales'],
            'orders' => $ts['metrics']['totalOrders']
        ];
    }
    
    $rankingsEfficiency = [];
    foreach ($byEfficiency as $ts) {
        $rankingsEfficiency[] = [
            'userId' => $ts['userId'],
            'name' => $ts['name'],
            'value' => $ts['metrics']['efficiencyScore'],
            'sales' => $ts['metrics']['combinedSales'],  // ยอดรวม upsell
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
    
    // ========================================
    // 7. Get Previous Month Sales for Comparison
    // ========================================
    $prevMonth = $month - 1;
    $prevYear = $year;
    if ($prevMonth < 1) {
        $prevMonth = 12;
        $prevYear = $year - 1;
    }
    
    $sqlPrevMonth = "
        SELECT COALESCE(SUM(COALESCE(oi.net_total, oi.quantity * oi.price_per_unit)), 0) AS prev_sales
        FROM order_items oi
        JOIN orders o ON oi.parent_order_id = o.id
        JOIN users u ON oi.creator_id = u.id
        WHERE o.company_id = ?
            AND YEAR(o.order_date) = ? AND MONTH(o.order_date) = ?
            AND o.order_status NOT IN ('Cancelled', 'Returned', 'BadDebt')
            AND (oi.is_freebie = 0 OR oi.is_freebie IS NULL)
            AND u.company_id = ?
            AND u.role LIKE '%telesale%'
            AND u.status = 'active'
            $userFilter
    ";
    
    $prevParams = array_merge([$companyId, $prevYear, $prevMonth, $companyId], $userParams);
    $stmt = $pdo->prepare($sqlPrevMonth);
    $stmt->execute($prevParams);
    $prevResult = $stmt->fetch(PDO::FETCH_ASSOC);
    $previousMonthSales = floatval($prevResult['prev_sales'] ?? 0);
    
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
            'previousMonthSales' => $previousMonthSales,
            'rankings' => [
                'byConversion' => $rankingsConversion,
                'byRetention' => $rankingsRetention,
                'byAov' => $rankingsAov,  // เปลี่ยนจาก Active เป็น AOV
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
