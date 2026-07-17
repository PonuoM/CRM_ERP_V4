<?php
/**
 * Telesale Daily Performance API
 * 
 * Fetches metrics grouped by User and Date for a specific date range.
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
    $startDate = isset($_GET['start_date']) ? $_GET['start_date'] : date('Y-m-d');
    $endDate = isset($_GET['end_date']) ? $_GET['end_date'] : date('Y-m-d');
    $startTime = isset($_GET['start_time']) && $_GET['start_time'] !== '' ? $_GET['start_time'] . ':00' : '00:00:00';
    $endTime = isset($_GET['end_time']) && $_GET['end_time'] !== '' ? $_GET['end_time'] . ':59' : '23:59:59';
    
    // Validate dates
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $startDate) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $endDate)) {
        json_response(['success' => false, 'message' => 'Invalid date format. Use YYYY-MM-DD.'], 400);
        exit;
    }

    // Build user filter
    $userFilter = "";
    $userParams = [];

    if ($isSupervisor && !$isAdmin && !$isCEO) {
        $userFilter = " AND (u.supervisor_id = ? OR u.id = ?)";
        $userParams = [$currentUserId, $currentUserId];
    } elseif (!$isAdmin && !$isCEO && !$isSupervisor) {
        $userFilter = " AND u.id = ?";
        $userParams = [$currentUserId];
    }

    // Basket Keys
    $TIER_NEW_KEYS = [38, 46, 47, 48];
    $TIER_CORE_KEYS = [39, 40];
    $TIER_REVIVAL_KEYS = [49, 50];
    $newKeysIn = implode(',', $TIER_NEW_KEYS);
    $coreKeysIn = implode(',', $TIER_CORE_KEYS);
    $revivalKeysIn = implode(',', $TIER_REVIVAL_KEYS);
    $allSegmentKeysIn = implode(',', array_merge($TIER_NEW_KEYS, $TIER_CORE_KEYS, $TIER_REVIVAL_KEYS));

    // Visible Users
    // Visible Users
    $sqlVisibleUsers = "
        SELECT u.id, u.first_name, u.last_name, u.phone, u.supervisor_id, u.role_id, u.role, sup.first_name AS supervisor_name
        FROM users u 
        LEFT JOIN users sup ON u.supervisor_id = sup.id
        WHERE u.company_id = ? AND u.role_id IN (3, 6, 7) AND u.status = 'active' $userFilter
        UNION
        SELECT DISTINCT u.id, u.first_name, u.last_name, u.phone, u.supervisor_id, u.role_id, u.role, sup.first_name AS supervisor_name
        FROM users u
        LEFT JOIN users sup ON u.supervisor_id = sup.id
        JOIN order_items oi ON oi.creator_id = u.id
        JOIN orders o ON oi.parent_order_id = o.id
        WHERE u.company_id = ? AND u.role_id IN (3, 6, 7) AND u.status != 'active'
            AND DATE(o.order_date) BETWEEN ? AND ?
            AND TIME(o.order_date) BETWEEN ? AND ?
            AND o.order_status NOT IN ('Cancelled', 'BadDebt')
            AND (oi.is_freebie = 0 OR oi.is_freebie IS NULL)
            AND oi.parent_item_id IS NULL
            $userFilter
    ";
    $visibleParams = array_merge([$companyId], $userParams, [$companyId, $startDate, $endDate, $startTime, $endTime], $userParams);
    $stmt = $pdo->prepare($sqlVisibleUsers);
    $stmt->execute($visibleParams);
    $visibleUsersList = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $visibleIds = array_column($visibleUsersList, 'id');
    if (empty($visibleIds)) {
        json_response([
            'success' => true,
            'data' => [
                'dailyRecords' => [],
                'users' => []
            ]
        ]);
        exit;
    }

    $resolveTeamName = function($u) use ($visibleUsersList) {
        if ($u['role_id'] == 3 || stripos($u['role'], 'admin page') !== false) {
            return 'ทีม Admin Page';
        }
        if (!empty($u['supervisor_id']) && !empty($u['supervisor_name'])) {
            return 'ทีม ' . trim($u['supervisor_name']);
        }
        $isSup = in_array($u['id'], array_column($visibleUsersList, 'supervisor_id'));
        if ($isSup) {
            return 'ทีม ' . trim($u['first_name']);
        }
        return 'อื่นๆ';
    };
    $visibleIdsIn = implode(',', array_map('intval', $visibleIds));
    $visibleFilter = "u.id IN ($visibleIdsIn)";

    // Pre-fill daily data array
    $dateStart = new DateTime($startDate);
    $dateEnd = new DateTime($endDate);
    $dateEnd->modify('+1 day'); // to include end date
    $interval = DateInterval::createFromDateString('1 day');
    $period = new DatePeriod($dateStart, $interval, $dateEnd);

    $dailyData = [];
    foreach ($period as $dt) {
        $d = $dt->format("Y-m-d");
        $dailyData[$d] = [];
        foreach ($visibleUsersList as $u) {
            $dailyData[$d][$u['id']] = [
                'userId' => intval($u['id']),
                'name' => trim($u['first_name'] . ' ' . $u['last_name']),
                'team' => $resolveTeamName($u),
                'date' => $d,
                'metrics' => [
                    'totalCalls' => 0,
                    'connectedCalls' => 0,
                    'talkedCalls' => 0,
                    'missedCalls' => 0,
                    'totalMinutes' => 0,
                    'answerRate' => 0,
                    'workingHours' => 0,
                    
                    'totalSales' => 0, // ยอดขายสุทธิปกติ (ไม่รวม upsell)
                    'upsellSales' => 0,
                    'cancelledSales' => 0,
                    'returnedSales' => 0,
                    'grossSales' => 0, // ยอดขายตั้งต้นทุกสถานะ (ก่อนหัก)
                    
                    'totalOrders' => 0, // สุทธิปกติ
                    'upsellOrders' => 0,
                    'grossOrders' => 0, // จำนวนบิลทั้งหมด
                    
                    'newCustOrders' => 0,
                    'newCustSales' => 0,
                    'coreCustOrders' => 0,
                    'coreCustSales' => 0,
                    'revivalCustOrders' => 0,
                    'revivalCustSales' => 0,
                    
                    'bioSales' => 0,
                    'fertilizerSales' => 0,
                    'otherSales' => 0,
                ]
            ];
        }
    }

    // 1. Call Data
    $sqlCalls = "
        SELECT 
            DATE(cl.call_date) AS call_day,
            u.id AS user_id,
            COUNT(cl.id) AS total_calls,
            SUM(CASE WHEN cl.status = 1 THEN 1 ELSE 0 END) AS connected_calls,
            SUM(CASE WHEN cl.status = 1 AND TIME_TO_SEC(cl.duration) >= 30 THEN 1 ELSE 0 END) AS talked_calls,
            SUM(CASE WHEN cl.status = 0 THEN 1 ELSE 0 END) AS missed_calls,
            ROUND(COALESCE(SUM(TIME_TO_SEC(cl.duration)), 0) / 60, 2) AS total_minutes
        FROM users u
        JOIN call_import_logs cl ON cl.matched_user_id = u.id
        WHERE u.company_id = ?
            AND DATE(cl.call_date) BETWEEN ? AND ?
            AND TIME(cl.call_date) BETWEEN ? AND ?
            AND $visibleFilter
        GROUP BY DATE(cl.call_date), u.id
    ";
    $stmt = $pdo->prepare($sqlCalls);
    $stmt->execute([$companyId, $startDate, $endDate, $startTime, $endTime]);
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $d = $row['call_day'];
        $uid = $row['user_id'];
        if (isset($dailyData[$d][$uid])) {
            $m = &$dailyData[$d][$uid]['metrics'];
            $m['totalCalls'] = intval($row['total_calls']);
            $m['connectedCalls'] = intval($row['connected_calls']);
            $m['talkedCalls'] = intval($row['talked_calls']);
            $m['missedCalls'] = intval($row['missed_calls']);
            $m['totalMinutes'] = floatval($row['total_minutes']);
            $m['answerRate'] = $m['totalCalls'] > 0 ? round(($m['connectedCalls'] / $m['totalCalls']) * 100, 1) : 0;
        }
    }

    // 2. Gross Orders & Sales (ทุกสถานะ เพื่อหายอดรวมตั้งต้น)
    $sqlGrossOrders = "
        SELECT 
            DATE(o.order_date) AS order_day,
            oi.creator_id AS user_id,
            COUNT(DISTINCT o.id) AS gross_orders,
            COALESCE(SUM(COALESCE(oi.net_total, oi.quantity * oi.price_per_unit)), 0) AS gross_sales,
            -- Cancelled
            SUM(CASE WHEN o.order_status = 'Cancelled' THEN COALESCE(oi.net_total, oi.quantity * oi.price_per_unit) ELSE 0 END) AS cancelled_sales,
            -- Returned
            SUM(CASE WHEN (o.order_status = 'Returned' OR ob.status = 'RETURNED') THEN COALESCE(oi.net_total, oi.quantity * oi.price_per_unit) ELSE 0 END) AS returned_sales,
            -- Net Regular Sales (Exclude Cancel, Return, BadDebt, and Upsell)
            SUM(CASE WHEN o.order_status NOT IN ('Cancelled', 'BadDebt', 'Returned') AND (ob.status IS NULL OR ob.status != 'RETURNED') AND (oi.basket_key_at_sale IS NULL OR oi.basket_key_at_sale != 51) THEN COALESCE(oi.net_total, oi.quantity * oi.price_per_unit) ELSE 0 END) AS net_regular_sales,
            COUNT(DISTINCT CASE WHEN o.order_status NOT IN ('Cancelled', 'BadDebt', 'Returned') AND (ob.status IS NULL OR ob.status != 'RETURNED') AND (oi.basket_key_at_sale IS NULL OR oi.basket_key_at_sale != 51) THEN o.id END) AS net_regular_orders,
            -- Upsell Net Sales
            SUM(CASE WHEN o.order_status NOT IN ('Cancelled', 'BadDebt', 'Returned') AND (ob.status IS NULL OR ob.status != 'RETURNED') AND oi.basket_key_at_sale = 51 THEN COALESCE(oi.net_total, oi.quantity * oi.price_per_unit) ELSE 0 END) AS net_upsell_sales,
            COUNT(DISTINCT CASE WHEN o.order_status NOT IN ('Cancelled', 'BadDebt', 'Returned') AND (ob.status IS NULL OR ob.status != 'RETURNED') AND oi.basket_key_at_sale = 51 THEN o.id END) AS net_upsell_orders
        FROM order_items oi
        JOIN orders o ON oi.parent_order_id = o.id
        LEFT JOIN order_boxes ob ON ob.sub_order_id = oi.order_id
        JOIN users u ON oi.creator_id = u.id
        WHERE o.company_id = ?
            AND DATE(o.order_date) BETWEEN ? AND ?
            AND TIME(o.order_date) BETWEEN ? AND ?
            AND (oi.is_freebie = 0 OR oi.is_freebie IS NULL)
            AND oi.parent_item_id IS NULL
            AND $visibleFilter
        GROUP BY DATE(o.order_date), oi.creator_id
    ";
    $stmt = $pdo->prepare($sqlGrossOrders);
    $stmt->execute([$companyId, $startDate, $endDate, $startTime, $endTime]);
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $d = $row['order_day'];
        $uid = $row['user_id'];
        if (isset($dailyData[$d][$uid])) {
            $m = &$dailyData[$d][$uid]['metrics'];
            $m['grossOrders'] = intval($row['gross_orders']);
            $m['grossSales'] = floatval($row['gross_sales']);
            $m['cancelledSales'] = floatval($row['cancelled_sales']);
            $m['returnedSales'] = floatval($row['returned_sales']);
            $m['totalSales'] = floatval($row['net_regular_sales']);
            $m['totalOrders'] = intval($row['net_regular_orders']);
            $m['upsellSales'] = floatval($row['net_upsell_sales']);
            $m['upsellOrders'] = intval($row['net_upsell_orders']);
        }
    }

    // 3. Segment Sales & Category Sales (Net Only - Exclude Cancelled & BadDebt to match main KPI logic)
    $sqlSegmentSales = "
        SELECT 
            DATE(o.order_date) AS order_day,
            oi.creator_id AS user_id,
            -- New
            COUNT(DISTINCT CASE WHEN COALESCE(oi.basket_key_at_sale, o.basket_key_at_sale) IN ($newKeysIn) THEN o.id END) AS new_orders,
            SUM(CASE WHEN COALESCE(oi.basket_key_at_sale, o.basket_key_at_sale) IN ($newKeysIn) THEN COALESCE(oi.net_total, oi.quantity * oi.price_per_unit) ELSE 0 END) AS new_sales,
            -- Core
            COUNT(DISTINCT CASE WHEN COALESCE(oi.basket_key_at_sale, o.basket_key_at_sale) IN ($coreKeysIn) THEN o.id END) AS core_orders,
            SUM(CASE WHEN COALESCE(oi.basket_key_at_sale, o.basket_key_at_sale) IN ($coreKeysIn) THEN COALESCE(oi.net_total, oi.quantity * oi.price_per_unit) ELSE 0 END) AS core_sales,
            -- Revival
            COUNT(DISTINCT CASE WHEN COALESCE(oi.basket_key_at_sale, o.basket_key_at_sale) IN ($revivalKeysIn) THEN o.id END) AS revival_orders,
            SUM(CASE WHEN COALESCE(oi.basket_key_at_sale, o.basket_key_at_sale) IN ($revivalKeysIn) THEN COALESCE(oi.net_total, oi.quantity * oi.price_per_unit) ELSE 0 END) AS revival_sales,
            -- Category
            SUM(CASE WHEN p.category LIKE '%ชีวภัณฑ์%' THEN COALESCE(oi.net_total, oi.quantity * oi.price_per_unit) ELSE 0 END) AS bio_sales,
            SUM(CASE WHEN p.category LIKE '%ปุ๋ย%' THEN COALESCE(oi.net_total, oi.quantity * oi.price_per_unit) ELSE 0 END) AS fertilizer_sales,
            SUM(CASE WHEN p.category NOT LIKE '%ชีวภัณฑ์%' AND p.category NOT LIKE '%ปุ๋ย%' THEN COALESCE(oi.net_total, oi.quantity * oi.price_per_unit) ELSE 0 END) AS other_sales
        FROM order_items oi
        JOIN orders o ON oi.parent_order_id = o.id
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE o.company_id = ?
            AND DATE(o.order_date) BETWEEN ? AND ?
            AND TIME(o.order_date) BETWEEN ? AND ?
            AND o.order_status NOT IN ('Cancelled', 'BadDebt')
            AND (oi.is_freebie = 0 OR oi.is_freebie IS NULL)
            AND oi.parent_item_id IS NULL
            AND oi.creator_id IN ($visibleIdsIn)
        GROUP BY DATE(o.order_date), oi.creator_id
    ";
    $stmt = $pdo->prepare($sqlSegmentSales);
    $stmt->execute([$companyId, $startDate, $endDate, $startTime, $endTime]);
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $d = $row['order_day'];
        $uid = $row['user_id'];
        if (isset($dailyData[$d][$uid])) {
            $m = &$dailyData[$d][$uid]['metrics'];
            $m['newCustOrders'] = intval($row['new_orders']);
            $m['newCustSales'] = floatval($row['new_sales']);
            $m['coreCustOrders'] = intval($row['core_orders']);
            $m['coreCustSales'] = floatval($row['core_sales']);
            $m['revivalCustOrders'] = intval($row['revival_orders']);
            $m['revivalCustSales'] = floatval($row['revival_sales']);
            
            $m['bioSales'] = floatval($row['bio_sales']);
            $m['fertilizerSales'] = floatval($row['fertilizer_sales']);
            $m['otherSales'] = floatval($row['other_sales']);
        }
    }

    // 5. Attendance Data (working hours = attendance_value * 8)
    $sqlAttendance = "
        SELECT 
            DATE(work_date) AS work_day,
            user_id,
            SUM(attendance_value) AS working_days
        FROM user_daily_attendance
        WHERE DATE(work_date) BETWEEN ? AND ?
        GROUP BY DATE(work_date), user_id
    ";
    $stmt = $pdo->prepare($sqlAttendance);
    $stmt->execute([$startDate, $endDate]);
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $d = $row['work_day'];
        $uid = $row['user_id'];
        if (isset($dailyData[$d][$uid])) {
            $workingDays = floatval($row['working_days']);
            $dailyData[$d][$uid]['metrics']['workingHours'] = $workingDays * 8;
        }
    }

    // Flatten data for frontend
    $flatData = [];
    foreach ($dailyData as $d => $users) {
        foreach ($users as $uid => $record) {
            $flatData[] = $record;
        }
    }

    // Also send a user list for filtering
    $usersList = array_map(function($u) use ($resolveTeamName) {
        return [
            'id' => $u['id'],
            'name' => trim($u['first_name'] . ' ' . $u['last_name']),
            'team' => $resolveTeamName($u)
        ];
    }, $visibleUsersList);

    json_response([
        'success' => true,
        'data' => [
            'dailyRecords' => $flatData,
            'users' => $usersList
        ]
    ]);

} catch (Exception $e) {
    error_log("Error in telesale_daily_performance API: " . $e->getMessage());
    json_response(['success' => false, 'message' => 'Internal server error: ' . $e->getMessage()], 500);
}
