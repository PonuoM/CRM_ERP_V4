<?php
/**
 * Telesale Performance Dashboard API - V3 Redesign
 * 
 * Metrics provided:
 * - Sales: Regular + Upsell (separated)
 * - Customer Segments: New (38,46,47), Core (39,40), Revival (48,49,50)
 * - AOV by Category: ปุ๋ย vs ชีวภัณฑ์
 * - Call Metrics: Total, Answered, Duration, Avg/call, Avg/day
 * - Attendance: Working days
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

    // Role check - Admin, CEO, Supervisor, or Telesale
    $isAdmin = strpos($currentUserRole, 'admin') !== false && strpos($currentUserRole, 'supervisor') === false && strpos($currentUserRole, 'admin page') === false;
    $isSupervisor = strpos($currentUserRole, 'supervisor') !== false;
    $isCEO = strpos($currentUserRole, 'ceo') !== false;
    $isTelesale = strpos($currentUserRole, 'telesale') !== false || strpos($currentUserRole, 'admin page') !== false;

    if (!$isAdmin && !$isSupervisor && !$isCEO && !$isTelesale) {
        json_response(['success' => false, 'message' => 'Access denied. Valid role required.'], 403);
        exit;
    }

    // Get parameters
    $year = isset($_GET['year']) ? intval($_GET['year']) : intval(date('Y'));
    $month = isset($_GET['month']) ? intval($_GET['month']) : intval(date('m'));
    $specificDate = isset($_GET['date']) ? $_GET['date'] : null; // YYYY-MM-DD for daily view

    // Build date filter based on mode (monthly vs daily)
    $isDaily = !empty($specificDate) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $specificDate);

    // For calls/orders - date filter conditions
    if ($isDaily) {
        $dateFilterCalls = "DATE(cl.call_date) = ?";
        $dateFilterOrders = "DATE(o.order_date) = ?";
        $dateFilterAttendance = "DATE(uda.date) = ?";
        $dateParams = [$specificDate];
    } else {
        $dateFilterCalls = "DATE_FORMAT(cl.call_date, '%Y-%m') = ?";
        $dateFilterOrders = "YEAR(o.order_date) = ? AND MONTH(o.order_date) = ?";
        $dateFilterAttendance = "YEAR(uda.date) = ? AND MONTH(uda.date) = ?";
        $dateParams = [$year, $month];
        $dateParamsCalls = [sprintf('%04d-%02d', $year, $month)];
    }

    // Build user filter for Supervisor and Telesale (Admin and CEO see all)
    $userFilter = "";
    $userParams = [];

    if ($isSupervisor && !$isAdmin && !$isCEO) {
        // Supervisor sees their team AND themselves
        $userFilter = " AND (u.supervisor_id = ? OR u.id = ?)";
        $userParams = [$currentUserId, $currentUserId];
    } elseif (!$isAdmin && !$isCEO && !$isSupervisor) {
        // Normal telesale sees only themselves
        $userFilter = " AND u.id = ?";
        $userParams = [$currentUserId];
    }

    // ========================================
    // TIER DEFINITIONS (Basket Keys) - UPDATED
    // ========================================
    // ลูกค้าใหม่ (New) - basket_key 48 ย้ายมาอยู่กลุ่มนี้
    $TIER_NEW_KEYS = [38, 46, 47, 48];

    // ลูกค้าเก่า 3 เดือน (Core)
    $TIER_CORE_KEYS = [39, 40];

    // ลูกค้าขุด (Revival/Win-back) - basket_key 48 ย้ายไปกลุ่มลูกค้าใหม่
    $TIER_REVIVAL_KEYS = [49, 50];

    // SQL IN clause helpers
    $newKeysIn = implode(',', $TIER_NEW_KEYS);
    $coreKeysIn = implode(',', $TIER_CORE_KEYS);
    $revivalKeysIn = implode(',', $TIER_REVIVAL_KEYS);

    // ========================================
    // PRE-COMPUTATION: Visible User IDs
    // Active users always show; inactive users show if they had orders in the period
    // This ensures historical performance data is preserved after deactivation
    // ========================================
    if ($isDaily) {
        $visibleYear = intval(substr($specificDate, 0, 4));
        $visibleMonth = intval(substr($specificDate, 5, 2));
    } else {
        $visibleYear = $year;
        $visibleMonth = $month;
    }

    $sqlVisibleUsers = "
        SELECT u.id FROM users u 
        WHERE u.company_id = ? AND (u.role LIKE '%telesale%' OR u.role LIKE '%admin page%') AND u.status = 'active' $userFilter
        UNION
        SELECT DISTINCT u.id FROM users u
        JOIN order_items oi ON oi.creator_id = u.id
        JOIN orders o ON oi.parent_order_id = o.id
        WHERE u.company_id = ? AND (u.role LIKE '%telesale%' OR u.role LIKE '%admin page%') AND u.status != 'active'
            AND YEAR(o.order_date) = ? AND MONTH(o.order_date) = ?
            AND o.order_status NOT IN ('Cancelled', 'BadDebt')
            AND (oi.is_freebie = 0 OR oi.is_freebie IS NULL)
            AND oi.parent_item_id IS NULL
            $userFilter
    ";
    $visibleParams = array_merge([$companyId], $userParams, [$companyId, $visibleYear, $visibleMonth], $userParams);
    $stmt = $pdo->prepare($sqlVisibleUsers);
    $stmt->execute($visibleParams);
    $visibleIds = array_column($stmt->fetchAll(PDO::FETCH_ASSOC), 'id');

    if (empty($visibleIds)) {
        $visibleIdsIn = '0';
    } else {
        $visibleIdsIn = implode(',', array_map('intval', $visibleIds));
    }
    $visibleFilter = "u.id IN ($visibleIdsIn)";

    // ========================================
    // 1. Get Call Data from call_import_logs
    // ========================================
    $callDateParam = $isDaily ? $dateParams : $dateParamsCalls;
    $sqlCalls = "
        SELECT 
            u.id AS user_id,
            u.first_name,
            u.last_name,
            u.phone AS telesale_phone,
            COUNT(cl.id) AS total_calls,
            SUM(CASE WHEN cl.status = 1 THEN 1 ELSE 0 END) AS connected_calls,
            SUM(CASE WHEN cl.status = 1 AND TIME_TO_SEC(cl.duration) >= 40 THEN 1 ELSE 0 END) AS talked_calls,
            SUM(CASE WHEN cl.status = 0 THEN 1 ELSE 0 END) AS missed_calls,
            SUM(CASE WHEN cl.rec_type = 1 THEN 1 ELSE 0 END) AS inbound_calls,
            SUM(CASE WHEN cl.rec_type = 2 THEN 1 ELSE 0 END) AS outbound_calls,
            ROUND(COALESCE(SUM(TIME_TO_SEC(cl.duration)), 0) / 60, 2) AS total_minutes,
            ROUND(COALESCE(AVG(CASE WHEN TIME_TO_SEC(cl.duration) > 0 THEN TIME_TO_SEC(cl.duration) END), 0) / 60, 2) AS avg_duration_minutes
        FROM users u
        LEFT JOIN call_import_logs cl ON cl.matched_user_id = u.id
            AND $dateFilterCalls
        WHERE u.company_id = ?
            AND (u.role LIKE '%telesale%' OR u.role LIKE '%admin page%')
            AND $visibleFilter
            $userFilter
        GROUP BY u.id, u.first_name, u.last_name, u.phone
    ";

    $callParams = array_merge($callDateParam, [$companyId], $userParams);
    $stmt = $pdo->prepare($sqlCalls);
    $stmt->execute($callParams);
    $callData = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Index by user_id
    $callsByUser = [];
    foreach ($callData as $row) {
        $callsByUser[$row['user_id']] = $row;
    }

    // ========================================
    // 2. Get Order Data - REGULAR (not upsell)
    //    Exclude basket_key_at_sale = 51 (Upsell bucket)
    // ========================================
    $sqlOrdersRegular = "
        SELECT 
            oi.creator_id AS user_id,
            COUNT(DISTINCT o.id) AS total_orders,
            COALESCE(SUM(COALESCE(oi.net_total, oi.quantity * oi.price_per_unit)), 0) AS total_sales
        FROM order_items oi
        JOIN orders o ON oi.parent_order_id = o.id
        JOIN users u ON oi.creator_id = u.id
        WHERE o.company_id = ?
            AND $dateFilterOrders
            AND o.order_status NOT IN ('Cancelled', 'BadDebt')
            AND (oi.is_freebie = 0 OR oi.is_freebie IS NULL)
            AND oi.parent_item_id IS NULL
            AND (oi.basket_key_at_sale IS NULL OR oi.basket_key_at_sale != 51)  -- NOT upsell
            AND u.company_id = ?
            AND (u.role LIKE '%telesale%' OR u.role LIKE '%admin page%')
            AND $visibleFilter
            $userFilter
        GROUP BY oi.creator_id
    ";

    $orderParams = array_merge([$companyId], $dateParams, [$companyId], $userParams);
    $stmt = $pdo->prepare($sqlOrdersRegular);
    $stmt->execute($orderParams);
    $orderData = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $ordersByUser = [];
    foreach ($orderData as $row) {
        $ordersByUser[$row['user_id']] = $row;
    }

    // ========================================
    // 2b. Get Upsell Data - Items tagged as basket_key_at_sale = 51
    // ========================================
    $sqlUpsell = "
        SELECT 
            oi.creator_id AS user_id,
            COUNT(DISTINCT o.id) AS upsell_orders,
            COALESCE(SUM(COALESCE(oi.net_total, oi.quantity * oi.price_per_unit)), 0) AS upsell_sales
        FROM order_items oi
        JOIN orders o ON oi.parent_order_id = o.id
        JOIN users u ON oi.creator_id = u.id
        WHERE o.company_id = ?
            AND $dateFilterOrders
            AND o.order_status NOT IN ('Cancelled', 'BadDebt')
            AND (oi.is_freebie = 0 OR oi.is_freebie IS NULL)
            AND oi.parent_item_id IS NULL
            AND oi.basket_key_at_sale = 51  -- IS upsell (basket 51)
            AND u.company_id = ?
            AND (u.role LIKE '%telesale%' OR u.role LIKE '%admin page%')
            AND $visibleFilter
            $userFilter
        GROUP BY oi.creator_id
    ";

    $upsellParams = array_merge([$companyId], $dateParams, [$companyId], $userParams);
    $stmt = $pdo->prepare($sqlUpsell);
    $stmt->execute($upsellParams);
    $upsellData = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $upsellByUser = [];
    foreach ($upsellData as $row) {
        $upsellByUser[$row['user_id']] = $row;
    }

    // ========================================
    // 2c. Get Sales Targets
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
    // 3. AOV by Category (ปุ๋ย vs ชีวภัณฑ์)
    // ========================================
    $sqlAovByCategory = "
        SELECT 
            oi.creator_id AS user_id,
            CASE 
                WHEN p.category LIKE '%ปุ๋ย%' THEN 'fertilizer'
                WHEN p.category LIKE '%ชีวภัณฑ์%' THEN 'bio'
                ELSE 'other'
            END AS category_type,
            COUNT(DISTINCT o.id) AS orders,
            COALESCE(SUM(COALESCE(oi.net_total, oi.quantity * oi.price_per_unit)), 0) AS sales
        FROM order_items oi
        JOIN orders o ON oi.parent_order_id = o.id
        JOIN products p ON oi.product_id = p.id
        JOIN users u ON oi.creator_id = u.id
        WHERE o.company_id = ?
            AND $dateFilterOrders
            AND o.order_status NOT IN ('Cancelled', 'BadDebt')
            AND (oi.is_freebie = 0 OR oi.is_freebie IS NULL)
            AND oi.parent_item_id IS NULL
            AND u.company_id = ?
            AND (u.role LIKE '%telesale%' OR u.role LIKE '%admin page%')
            AND $visibleFilter
            $userFilter
        GROUP BY oi.creator_id, category_type
    ";

    $aovParams = array_merge([$companyId], $dateParams, [$companyId], $userParams);
    $stmt = $pdo->prepare($sqlAovByCategory);
    $stmt->execute($aovParams);
    $aovCategoryData = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Organize by user and category
    $aovByUserCategory = [];
    foreach ($aovCategoryData as $row) {
        $userId = $row['user_id'];
        $catType = $row['category_type'];
        if (!isset($aovByUserCategory[$userId])) {
            $aovByUserCategory[$userId] = ['fertilizer' => ['orders' => 0, 'sales' => 0], 'bio' => ['orders' => 0, 'sales' => 0]];
        }
        if ($catType === 'fertilizer' || $catType === 'bio') {
            $aovByUserCategory[$userId][$catType] = [
                'orders' => intval($row['orders']),
                'sales' => floatval($row['sales'])
            ];
        }
    }

    // ========================================
    // 4. Customer Segment Counts (from current_basket_key) - OPTIMIZED: Single Query
    // ========================================
    $allSegmentKeysIn = implode(',', array_merge($TIER_NEW_KEYS, $TIER_CORE_KEYS, $TIER_REVIVAL_KEYS));

    $sqlCustomerCounts = "
        SELECT 
            c.assigned_to AS user_id,
            SUM(CASE WHEN c.current_basket_key IN ($newKeysIn) THEN 1 ELSE 0 END) AS new_count,
            SUM(CASE WHEN c.current_basket_key IN ($coreKeysIn) THEN 1 ELSE 0 END) AS core_count,
            SUM(CASE WHEN c.current_basket_key IN ($revivalKeysIn) THEN 1 ELSE 0 END) AS revival_count
        FROM customers c
        JOIN users u ON c.assigned_to = u.id
        WHERE c.current_basket_key IN ($allSegmentKeysIn)
            AND c.company_id = ?
            AND u.company_id = ?
            AND (u.role LIKE '%telesale%' OR u.role LIKE '%admin page%')
            AND u.status = 'active'
            $userFilter
        GROUP BY c.assigned_to
    ";

    $custParams = array_merge([$companyId, $companyId], $userParams);
    $stmt = $pdo->prepare($sqlCustomerCounts);
    $stmt->execute($custParams);
    $custCountData = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $newCustCountByUser = [];
    $coreCustCountByUser = [];
    $revivalCustCountByUser = [];
    foreach ($custCountData as $row) {
        $newCustCountByUser[$row['user_id']] = intval($row['new_count']);
        $coreCustCountByUser[$row['user_id']] = intval($row['core_count']);
        $revivalCustCountByUser[$row['user_id']] = intval($row['revival_count']);
    }

    // ========================================
    // 5. Customer Segment Orders (from basket_key_at_sale) - OPTIMIZED: Single Query
    // ========================================
    $sqlSegmentOrders = "
        SELECT 
            oi.creator_id AS user_id,
            -- New Customer orders
            COUNT(DISTINCT CASE WHEN COALESCE(oi.basket_key_at_sale, o.basket_key_at_sale) IN ($newKeysIn) THEN o.id END) AS new_orders,
            COALESCE(SUM(CASE WHEN COALESCE(oi.basket_key_at_sale, o.basket_key_at_sale) IN ($newKeysIn) 
                THEN COALESCE(oi.net_total, oi.quantity * oi.price_per_unit) ELSE 0 END), 0) AS new_sales,
            -- Core Customer orders
            COUNT(DISTINCT CASE WHEN COALESCE(oi.basket_key_at_sale, o.basket_key_at_sale) IN ($coreKeysIn) THEN o.id END) AS core_orders,
            COALESCE(SUM(CASE WHEN COALESCE(oi.basket_key_at_sale, o.basket_key_at_sale) IN ($coreKeysIn) 
                THEN COALESCE(oi.net_total, oi.quantity * oi.price_per_unit) ELSE 0 END), 0) AS core_sales,
            -- Revival Customer orders
            COUNT(DISTINCT CASE WHEN COALESCE(oi.basket_key_at_sale, o.basket_key_at_sale) IN ($revivalKeysIn) THEN o.id END) AS revival_orders,
            COALESCE(SUM(CASE WHEN COALESCE(oi.basket_key_at_sale, o.basket_key_at_sale) IN ($revivalKeysIn) 
                THEN COALESCE(oi.net_total, oi.quantity * oi.price_per_unit) ELSE 0 END), 0) AS revival_sales
        FROM order_items oi
        JOIN orders o ON oi.parent_order_id = o.id
        JOIN users u ON oi.creator_id = u.id
        WHERE o.company_id = ?
            AND $dateFilterOrders
            AND o.order_status NOT IN ('Cancelled', 'BadDebt')
            AND (oi.is_freebie = 0 OR oi.is_freebie IS NULL)
            AND oi.parent_item_id IS NULL
            AND COALESCE(oi.basket_key_at_sale, o.basket_key_at_sale) IN ($allSegmentKeysIn)
            AND u.company_id = ?
            AND (u.role LIKE '%telesale%' OR u.role LIKE '%admin page%')
            AND $visibleFilter
            $userFilter
        GROUP BY oi.creator_id
    ";

    $segmentParams = array_merge([$companyId], $dateParams, [$companyId], $userParams);
    $stmt = $pdo->prepare($sqlSegmentOrders);
    $stmt->execute($segmentParams);
    $segmentOrdersData = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $newCustOrdersByUser = [];
    $newCustSalesByUser = [];
    $coreCustOrdersByUser = [];
    $coreCustSalesByUser = [];
    $revivalCustOrdersByUser = [];
    $revivalCustSalesByUser = [];
    foreach ($segmentOrdersData as $row) {
        $newCustOrdersByUser[$row['user_id']] = intval($row['new_orders']);
        $newCustSalesByUser[$row['user_id']] = floatval($row['new_sales']);
        $coreCustOrdersByUser[$row['user_id']] = intval($row['core_orders']);
        $coreCustSalesByUser[$row['user_id']] = floatval($row['core_sales']);
        $revivalCustOrdersByUser[$row['user_id']] = intval($row['revival_orders']);
        $revivalCustSalesByUser[$row['user_id']] = floatval($row['revival_sales']);
    }

    // ========================================
    // 6. Attendance Data (Working Days)
    // ========================================
    // For daily mode, just check that specific date
    // For monthly mode, sum all days in the month
    if ($isDaily) {
        $sqlAttendance = "
            SELECT 
                a.user_id,
                COALESCE(SUM(a.attendance_value), 0) AS working_days
            FROM user_daily_attendance a
            JOIN users u ON a.user_id = u.id
            WHERE DATE(a.work_date) = ?
                AND u.company_id = ?
                AND (u.role LIKE '%telesale%' OR u.role LIKE '%admin page%')
                AND $visibleFilter
                $userFilter
            GROUP BY a.user_id
        ";
        $attendParams = array_merge([$specificDate, $companyId], $userParams);
    } else {
        $startDate = sprintf('%04d-%02d-01', $year, $month);
        $endDate = date('Y-m-t', strtotime($startDate));

        $sqlAttendance = "
            SELECT 
                a.user_id,
                COALESCE(SUM(a.attendance_value), 0) AS working_days
            FROM user_daily_attendance a
            JOIN users u ON a.user_id = u.id
            WHERE a.work_date BETWEEN ? AND ?
                AND a.work_date < CURDATE()
                AND u.company_id = ?
                AND (u.role LIKE '%telesale%' OR u.role LIKE '%admin page%')
                AND $visibleFilter
                $userFilter
            GROUP BY a.user_id
        ";
        $attendParams = array_merge([$startDate, $endDate, $companyId], $userParams);
    }
    $stmt = $pdo->prepare($sqlAttendance);
    $stmt->execute($attendParams);
    $attendData = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $attendByUser = [];
    foreach ($attendData as $row) {
        $attendByUser[$row['user_id']] = floatval($row['working_days']);
    }

    // ========================================
    // 6b. Returned Orders Data
    // ========================================
    $sqlReturned = "
        SELECT 
            oi.creator_id AS user_id,
            COUNT(DISTINCT o.id) AS returned_orders,
            COALESCE(SUM(COALESCE(oi.net_total, oi.quantity * oi.price_per_unit)), 0) AS returned_sales
        FROM order_items oi
        JOIN orders o ON oi.parent_order_id = o.id
        JOIN users u ON oi.creator_id = u.id
        LEFT JOIN order_boxes ob ON ob.sub_order_id = oi.order_id
        WHERE o.company_id = ?
            AND $dateFilterOrders
            AND (o.order_status = 'Returned' OR ob.status = 'RETURNED')
            AND (oi.is_freebie = 0 OR oi.is_freebie IS NULL)
            AND oi.parent_item_id IS NULL
            AND u.company_id = ?
            AND (u.role LIKE '%telesale%' OR u.role LIKE '%admin page%')
            AND $visibleFilter
            $userFilter
        GROUP BY oi.creator_id
    ";

    $returnedParams = array_merge([$companyId], $dateParams, [$companyId], $userParams);
    $stmt = $pdo->prepare($sqlReturned);
    $stmt->execute($returnedParams);
    $returnedData = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $returnedByUser = [];
    foreach ($returnedData as $row) {
        $returnedByUser[$row['user_id']] = $row;
    }

    // ========================================
    // 7. Combine All Data
    // ========================================
    $telesaleDetails = [];

    foreach ($callsByUser as $userId => $callInfo) {
        $orders = $ordersByUser[$userId] ?? ['total_orders' => 0, 'total_sales' => 0];
        $upsell = $upsellByUser[$userId] ?? ['upsell_orders' => 0, 'upsell_sales' => 0];
        $returned = $returnedByUser[$userId] ?? ['returned_orders' => 0, 'returned_sales' => 0];
        $aovCat = $aovByUserCategory[$userId] ?? ['fertilizer' => ['orders' => 0, 'sales' => 0], 'bio' => ['orders' => 0, 'sales' => 0]];

        // Call metrics
        $totalCalls = intval($callInfo['total_calls']);
        $connectedCalls = intval($callInfo['connected_calls']);
        $talkedCalls = intval($callInfo['talked_calls']);
        $missedCalls = intval($callInfo['missed_calls']);
        $inboundCalls = intval($callInfo['inbound_calls']);
        $outboundCalls = intval($callInfo['outbound_calls']);
        $totalMinutes = floatval($callInfo['total_minutes']);
        $avgMinutesPerCall = floatval($callInfo['avg_duration_minutes']);
        $answerRate = $totalCalls > 0 ? round(($connectedCalls / $totalCalls) * 100, 1) : 0;

        // Order metrics
        $totalOrders = intval($orders['total_orders']);
        $totalSales = floatval($orders['total_sales']);  // Regular sales only

        // Upsell metrics
        $upsellOrders = intval($upsell['upsell_orders']);
        $upsellSales = floatval($upsell['upsell_sales']);

        // Returned metrics
        $returnedOrders = intval($returned['returned_orders']);
        $returnedSales = floatval($returned['returned_sales']);

        // Combined
        $combinedSales = $totalSales + $upsellSales;

        // All orders for conversion rate (regular + upsell)
        $allOrders = $totalOrders + $upsellOrders;

        // Conversion rate
        $conversionRate = $talkedCalls > 0 ? round(($allOrders / $talkedCalls) * 100, 2) : 0;

        // AOV by category
        $aovFertilizer = $aovCat['fertilizer']['orders'] > 0
            ? round($aovCat['fertilizer']['sales'] / $aovCat['fertilizer']['orders'], 0)
            : 0;
        $aovBio = $aovCat['bio']['orders'] > 0
            ? round($aovCat['bio']['sales'] / $aovCat['bio']['orders'], 0)
            : 0;

        // Customer segments - counts
        $newCustCount = $newCustCountByUser[$userId] ?? 0;
        $coreCustCount = $coreCustCountByUser[$userId] ?? 0;
        $revivalCustCount = $revivalCustCountByUser[$userId] ?? 0;

        // Customer segments - orders
        $newCustOrders = $newCustOrdersByUser[$userId] ?? 0;
        $coreCustOrders = $coreCustOrdersByUser[$userId] ?? 0;
        $revivalCustOrders = $revivalCustOrdersByUser[$userId] ?? 0;

        // Customer segments - sales
        $newCustSales = $newCustSalesByUser[$userId] ?? 0;
        $coreCustSales = $coreCustSalesByUser[$userId] ?? 0;
        $revivalCustSales = $revivalCustSalesByUser[$userId] ?? 0;

        // Customer segments - rates
        $newCustRate = $newCustCount > 0 ? round(($newCustOrders / $newCustCount) * 100, 1) : 0;
        $coreCustRate = $coreCustCount > 0 ? round(($coreCustOrders / $coreCustCount) * 100, 1) : 0;
        $revivalCustRate = $revivalCustCount > 0 ? round(($revivalCustOrders / $revivalCustCount) * 100, 1) : 0;

        // Attendance
        $workingDays = $attendByUser[$userId] ?? 0;
        $avgMinutesPerDay = $workingDays > 0 ? round($totalMinutes / $workingDays, 1) : 0;

        // Target
        $targetAmount = $targetsByUser[$userId] ?? 0;
        $targetProgress = $targetAmount > 0 ? round(($combinedSales / $targetAmount) * 100, 1) : 0;

        $telesaleDetails[] = [
            'userId' => intval($userId),
            'name' => trim($callInfo['first_name'] . ' ' . $callInfo['last_name']),
            'firstName' => $callInfo['first_name'],
            'phone' => $callInfo['telesale_phone'],
            'metrics' => [
                // Orders & Conversion
                'totalOrders' => $allOrders,
                'conversionRate' => $conversionRate,

                // Sales
                'totalSales' => $totalSales,           // ยอดขายปกติ (ไม่รวม upsell)
                'upsellOrders' => $upsellOrders,
                'upsellSales' => $upsellSales,
                'combinedSales' => $combinedSales,     // ยอดขายรวม ★

                // Customers 3 months (Core)
                'customers90Days' => $coreCustCount,

                // AOV by category
                'aovFertilizer' => $aovFertilizer,
                'aovBio' => $aovBio,

                // ลูกค้าใหม่ (38,46,47)
                'newCustCount' => $newCustCount,
                'newCustOrders' => $newCustOrders,
                'newCustSales' => $newCustSales,
                'newCustRate' => $newCustRate,

                // ลูกค้าเก่า (39,40)
                'coreCustCount' => $coreCustCount,
                'coreCustOrders' => $coreCustOrders,
                'coreCustSales' => $coreCustSales,
                'coreCustRate' => $coreCustRate,

                // ลูกค้าขุด (48,49,50)
                'revivalCustCount' => $revivalCustCount,
                'revivalCustOrders' => $revivalCustOrders,
                'revivalCustSales' => $revivalCustSales,
                'revivalCustRate' => $revivalCustRate,

                // Returned (ตีกลับ)
                'returnedOrders' => $returnedOrders,
                'returnedSales' => $returnedSales,

                // Target
                'targetAmount' => $targetAmount,
                'targetProgress' => $targetProgress,

                // Call metrics
                'totalCalls' => $totalCalls,
                'connectedCalls' => $connectedCalls,
                'talkedCalls' => $talkedCalls,
                'answeredCalls' => $connectedCalls,  // backward compat
                'missedCalls' => $missedCalls,
                'inboundCalls' => $inboundCalls,
                'outboundCalls' => $outboundCalls,
                'answerRate' => $answerRate,
                'totalMinutes' => round($totalMinutes, 1),
                'avgMinutesPerCall' => $avgMinutesPerCall,

                // Attendance
                'workingDays' => $workingDays,
                'avgMinutesPerDay' => $avgMinutesPerDay,
            ]
        ];
    }

    // ========================================
    // 8. Calculate Team Totals/Averages
    // ========================================
    $totalTelesales = count($telesaleDetails);
    $teamTotals = [
        'totalOrders' => 0,
        'totalSales' => 0,
        'upsellSales' => 0,
        'combinedSales' => 0,
        'totalCalls' => 0,
        'connectedCalls' => 0,
        'talkedCalls' => 0,
        'answeredCalls' => 0,
        'missedCalls' => 0,
        'inboundCalls' => 0,
        'totalMinutes' => 0,
        'newCustCount' => 0,
        'coreCustCount' => 0,
        'revivalCustCount' => 0,
        'newCustOrders' => 0,
        'coreCustOrders' => 0,
        'revivalCustOrders' => 0,
        'newCustSales' => 0,
        'coreCustSales' => 0,
        'revivalCustSales' => 0,
        'returnedSales' => 0,
        'conversionRate' => 0,
    ];

    if ($totalTelesales > 0) {
        foreach ($telesaleDetails as $ts) {
            $teamTotals['totalOrders'] += $ts['metrics']['totalOrders'];
            $teamTotals['totalSales'] += $ts['metrics']['totalSales'];
            $teamTotals['upsellSales'] += $ts['metrics']['upsellSales'];
            $teamTotals['combinedSales'] += $ts['metrics']['combinedSales'];
            $teamTotals['totalCalls'] += $ts['metrics']['totalCalls'];
            $teamTotals['connectedCalls'] += $ts['metrics']['connectedCalls'];
            $teamTotals['talkedCalls'] += $ts['metrics']['talkedCalls'];
            $teamTotals['answeredCalls'] += $ts['metrics']['connectedCalls'];
            $teamTotals['missedCalls'] += $ts['metrics']['missedCalls'];
            $teamTotals['inboundCalls'] += $ts['metrics']['inboundCalls'];
            $teamTotals['totalMinutes'] += $ts['metrics']['totalMinutes'];
            $teamTotals['newCustCount'] += $ts['metrics']['newCustCount'];
            $teamTotals['coreCustCount'] += $ts['metrics']['coreCustCount'];
            $teamTotals['revivalCustCount'] += $ts['metrics']['revivalCustCount'];
            $teamTotals['newCustOrders'] += $ts['metrics']['newCustOrders'];
            $teamTotals['coreCustOrders'] += $ts['metrics']['coreCustOrders'];
            $teamTotals['revivalCustOrders'] += $ts['metrics']['revivalCustOrders'];
            $teamTotals['newCustSales'] += $ts['metrics']['newCustSales'];
            $teamTotals['coreCustSales'] += $ts['metrics']['coreCustSales'];
            $teamTotals['revivalCustSales'] += $ts['metrics']['revivalCustSales'];
            $teamTotals['returnedSales'] += $ts['metrics']['returnedSales'];
        }

        // Calculate team conversion rate (ได้คุย / ออเดอร์)
        $teamTotals['conversionRate'] = $teamTotals['answeredCalls'] > 0
            ? round(($teamTotals['totalOrders'] / $teamTotals['answeredCalls']) * 100, 2)
            : 0;
    }

    // ========================================
    // 9. Get Previous Month Sales for Comparison
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
            AND o.order_status NOT IN ('Cancelled', 'BadDebt')
            AND (oi.is_freebie = 0 OR oi.is_freebie IS NULL)
            AND oi.parent_item_id IS NULL
            AND u.company_id = ?
            AND (u.role LIKE '%telesale%' OR u.role LIKE '%admin page%')
            AND $visibleFilter
            $userFilter
    ";

    $prevParams = array_merge([$companyId, $prevYear, $prevMonth, $companyId], $userParams);
    $stmt = $pdo->prepare($sqlPrevMonth);
    $stmt->execute($prevParams);
    $prevResult = $stmt->fetch(PDO::FETCH_ASSOC);
    $previousMonthSales = floatval($prevResult['prev_sales'] ?? 0);

    // ========================================
    // 10. Create Rankings
    // ========================================

    // By Conversion Rate
    $byConversion = $telesaleDetails;
    usort($byConversion, function ($a, $b) {
        return $b['metrics']['conversionRate'] <=> $a['metrics']['conversionRate'];
    });
    $rankingsConversion = array_map(function ($ts) {
        return [
            'userId' => $ts['userId'],
            'name' => $ts['name'],
            'value' => $ts['metrics']['conversionRate'],
            'calls' => $ts['metrics']['totalCalls'],
            'orders' => $ts['metrics']['totalOrders']
        ];
    }, array_slice($byConversion, 0, 10));

    // By Combined Sales
    $bySales = $telesaleDetails;
    usort($bySales, function ($a, $b) {
        return $b['metrics']['combinedSales'] <=> $a['metrics']['combinedSales'];
    });
    $rankingsSales = array_map(function ($ts) {
        return [
            'userId' => $ts['userId'],
            'name' => $ts['name'],
            'value' => $ts['metrics']['combinedSales'],
            'upsell' => $ts['metrics']['upsellSales']
        ];
    }, array_slice($bySales, 0, 10));

    // By Core Customer Rate (ลูกค้าเก่าซื้อซ้ำ)
    $byCoreRate = $telesaleDetails;
    usort($byCoreRate, function ($a, $b) {
        return $b['metrics']['coreCustRate'] <=> $a['metrics']['coreCustRate'];
    });
    $rankingsCoreRate = array_map(function ($ts) {
        return [
            'userId' => $ts['userId'],
            'name' => $ts['name'],
            'value' => $ts['metrics']['coreCustRate'],
            'orders' => $ts['metrics']['coreCustOrders'],
            'count' => $ts['metrics']['coreCustCount']
        ];
    }, array_slice($byCoreRate, 0, 10));

    // By Upsell Sales
    $byUpsell = $telesaleDetails;
    usort($byUpsell, function ($a, $b) {
        return $b['metrics']['upsellSales'] <=> $a['metrics']['upsellSales'];
    });
    $filteredUpsell = array_filter($byUpsell, function ($ts) {
        return $ts['metrics']['upsellSales'] > 0;
    });
    $rankingsUpsell = array_map(function ($ts) {
        return [
            'userId' => $ts['userId'],
            'name' => $ts['name'],
            'value' => $ts['metrics']['upsellSales'],
            'orders' => $ts['metrics']['upsellOrders']
        ];
    }, array_slice($filteredUpsell, 0, 10));

    // ========================================
    // 11. Return Response
    // ========================================
    json_response([
        'success' => true,
        'data' => [
            'period' => [
                'year' => $year,
                'month' => $month
            ],
            'teamTotals' => $teamTotals,
            'telesaleCount' => $totalTelesales,
            'previousMonthSales' => $previousMonthSales,
            'rankings' => [
                'byConversion' => $rankingsConversion,
                'bySales' => $rankingsSales,
                'byCoreRate' => $rankingsCoreRate,
                'byUpsell' => $rankingsUpsell
            ],
            'telesaleDetails' => $telesaleDetails,
            '_debug' => [
                'role' => $currentUserRole,
                'isAdmin' => $isAdmin,
                'isSupervisor' => $isSupervisor,
                'basketKeys' => [
                    'new' => $TIER_NEW_KEYS,
                    'core' => $TIER_CORE_KEYS,
                    'revival' => $TIER_REVIVAL_KEYS
                ]
            ]
        ]
    ]);

} catch (Exception $e) {
    json_response([
        'success' => false,
        'message' => 'Server error: ' . $e->getMessage()
    ], 500);
}
