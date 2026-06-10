<?php

function handle_shopee_loyalty(PDO $pdo, ?string $id, ?string $action): void
{
    $method = $_SERVER['REQUEST_METHOD'];
    $reqAction = $action ?? $_GET['action'] ?? null;

    // Ensure tables exist
    ensure_shopee_loyalty_tables($pdo);

    $user = get_authenticated_user($pdo);
    $companyId = $user['company_id'] ?? null;

    if (!$companyId) {
        json_response(['error' => 'COMPANY_REQUIRED'], 400);
    }

    if ($method === 'POST' && $reqAction === 'import') {
        handle_shopee_import($pdo, $companyId);
    } elseif ($method === 'GET' && $reqAction === 'members') {
        handle_get_members($pdo, $companyId);
    } elseif ($method === 'GET' && $reqAction === 'member_orders') {
        handle_get_member_orders($pdo, $companyId);
    } elseif ($method === 'GET' && $reqAction === 'member_coupons') {
        handle_get_member_coupons($pdo, $companyId);
    } elseif ($method === 'POST' && $reqAction === 'update_coupon') {
        handle_update_coupon($pdo, $companyId);
    } elseif ($method === 'GET' && $reqAction === 'settings') {
        handle_get_settings($pdo, $companyId);
    } elseif ($method === 'POST' && $reqAction === 'settings') {
        handle_update_settings($pdo, $companyId);
    } elseif ($method === 'GET' && $reqAction === 'dashboard_stats') {
        handle_dashboard_stats($pdo, $companyId);
    } else {
        json_response(['error' => 'INVALID_ENDPOINT'], 404);
    }
}

function parse_flexible_datetime(string $dateStr): string
{
    $dateStr = trim($dateStr);
    if (empty($dateStr)) {
        return date('Y-m-d H:i:s');
    }

    // Shopee Thailand typically exports as DD/MM/YYYY HH:MM
    // PHP's strtotime treats DD/MM/YYYY as MM/DD/YYYY (US format).
    // Converting slashes to dashes makes strtotime parse it as DD-MM-YYYY (EU format).
    if (preg_match('/^\d{1,2}\/\d{1,2}\/\d{4}/', $dateStr)) {
        $dateStr = str_replace('/', '-', $dateStr);
    }

    $timestamp = strtotime($dateStr);
    if ($timestamp === false) {
        return date('Y-m-d H:i:s');
    }

    return date('Y-m-d H:i:s', $timestamp);
}

function get_shopee_loyalty_settings(PDO $pdo, int $companyId): array
{
    $stmt = $pdo->prepare("SELECT spend_per_point, points_for_coupon, coupon_prefix, coupon_discount, coupon_min_spend, coupon_expiry_days, baseline_aov, target_aov, baseline_repeat_rate, target_repeat_rate, target_members, target_10_points, target_sales_percent, points_calculation_mode FROM shopee_loyalty_settings WHERE company_id = ?");
    $stmt->execute([$companyId]);
    $settings = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$settings) {
        return [
            'spend_per_point' => 1500.00,
            'points_for_coupon' => 10,
            'coupon_prefix' => 'CAT3000',
            'coupon_discount' => 300.00,
            'coupon_min_spend' => 1500.00,
            'coupon_expiry_days' => 30,
            'baseline_aov' => 696.00,
            'target_aov' => 850.00,
            'baseline_repeat_rate' => 17.78,
            'target_repeat_rate' => 25.00,
            'target_members' => 100,
            'target_10_points' => 20,
            'target_sales_percent' => 30.00,
            'points_calculation_mode' => 'capped'
        ];
    }
    return [
        'spend_per_point' => (float)$settings['spend_per_point'],
        'points_for_coupon' => (int)$settings['points_for_coupon'],
        'coupon_prefix' => (string)$settings['coupon_prefix'],
        'coupon_discount' => (float)$settings['coupon_discount'],
        'coupon_min_spend' => (float)$settings['coupon_min_spend'],
        'coupon_expiry_days' => (int)$settings['coupon_expiry_days'],
        'baseline_aov' => (float)$settings['baseline_aov'],
        'target_aov' => (float)$settings['target_aov'],
        'baseline_repeat_rate' => (float)$settings['baseline_repeat_rate'],
        'target_repeat_rate' => (float)$settings['target_repeat_rate'],
        'target_members' => (int)$settings['target_members'],
        'target_10_points' => (int)$settings['target_10_points'],
        'target_sales_percent' => (float)$settings['target_sales_percent'],
        'points_calculation_mode' => (string)$settings['points_calculation_mode'] ?: 'capped'
    ];
}

function handle_get_settings(PDO $pdo, int $companyId): void
{
    json_response(['settings' => get_shopee_loyalty_settings($pdo, $companyId)]);
}

function handle_update_settings(PDO $pdo, int $companyId): void
{
    $input = json_decode(file_get_contents('php://input'), true);
    $spendPerPoint = isset($input['spend_per_point']) ? (float)$input['spend_per_point'] : 1500.00;
    $pointsForCoupon = isset($input['points_for_coupon']) ? (int)$input['points_for_coupon'] : 10;
    $couponPrefix = isset($input['coupon_prefix']) ? (string)$input['coupon_prefix'] : 'CAT3000';
    $couponDiscount = isset($input['coupon_discount']) ? (float)$input['coupon_discount'] : 300.00;
    $couponMinSpend = isset($input['coupon_min_spend']) ? (float)$input['coupon_min_spend'] : 1500.00;
    $couponExpiryDays = isset($input['coupon_expiry_days']) ? (int)$input['coupon_expiry_days'] : 30;
    
    $baselineAov = isset($input['baseline_aov']) ? (float)$input['baseline_aov'] : 696.00;
    $targetAov = isset($input['target_aov']) ? (float)$input['target_aov'] : 850.00;
    $baselineRepeatRate = isset($input['baseline_repeat_rate']) ? (float)$input['baseline_repeat_rate'] : 17.78;
    $targetRepeatRate = isset($input['target_repeat_rate']) ? (float)$input['target_repeat_rate'] : 25.00;
    $targetMembers = isset($input['target_members']) ? (int)$input['target_members'] : 100;
    $target10Points = isset($input['target_10_points']) ? (int)$input['target_10_points'] : 20;
    $targetSalesPercent = isset($input['target_sales_percent']) ? (float)$input['target_sales_percent'] : 30.00;
    $pointsCalculationMode = isset($input['points_calculation_mode']) && $input['points_calculation_mode'] === 'proportional' ? 'proportional' : 'capped';

    if ($spendPerPoint <= 0 || $pointsForCoupon <= 0 || $couponDiscount < 0 || $couponMinSpend < 0 || $couponExpiryDays <= 0) {
        json_response(['error' => 'Invalid settings'], 400);
    }

    $stmt = $pdo->prepare("
        INSERT INTO shopee_loyalty_settings (company_id, spend_per_point, points_for_coupon, coupon_prefix, coupon_discount, coupon_min_spend, coupon_expiry_days, baseline_aov, target_aov, baseline_repeat_rate, target_repeat_rate, target_members, target_10_points, target_sales_percent, points_calculation_mode) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) 
        ON DUPLICATE KEY UPDATE 
            spend_per_point = VALUES(spend_per_point), 
            points_for_coupon = VALUES(points_for_coupon),
            coupon_prefix = VALUES(coupon_prefix),
            coupon_discount = VALUES(coupon_discount),
            coupon_min_spend = VALUES(coupon_min_spend),
            coupon_expiry_days = VALUES(coupon_expiry_days),
            baseline_aov = VALUES(baseline_aov),
            target_aov = VALUES(target_aov),
            baseline_repeat_rate = VALUES(baseline_repeat_rate),
            target_repeat_rate = VALUES(target_repeat_rate),
            target_members = VALUES(target_members),
            target_10_points = VALUES(target_10_points),
            target_sales_percent = VALUES(target_sales_percent),
            points_calculation_mode = VALUES(points_calculation_mode)
    ");
    $stmt->execute([
        $companyId, $spendPerPoint, $pointsForCoupon, $couponPrefix, $couponDiscount, $couponMinSpend, $couponExpiryDays,
        $baselineAov, $targetAov, $baselineRepeatRate, $targetRepeatRate, $targetMembers, $target10Points, $targetSalesPercent, $pointsCalculationMode
    ]);
    
    json_response(['ok' => true, 'settings' => get_shopee_loyalty_settings($pdo, $companyId)]);
}

function handle_shopee_import(PDO $pdo, int $companyId): void
{
    $input = json_decode(file_get_contents('php://input'), true);
    $orders = $input['orders'] ?? [];

    if (empty($orders)) {
        json_response(['error' => 'No orders provided'], 400);
    }

    $pdo->beginTransaction();
    try {
        $importedCount = 0;
        $couponsGenerated = 0;
        
        $settings = get_shopee_loyalty_settings($pdo, $companyId);
        $spendPerPoint = $settings['spend_per_point'];
        $pointsForCoupon = $settings['points_for_coupon'];
        $couponPrefix = $settings['coupon_prefix'] ?: 'CAT3000';
        $couponDiscount = $settings['coupon_discount'];
        $couponMinSpend = $settings['coupon_min_spend'];
        $couponExpiryDays = $settings['coupon_expiry_days'];
        $calculationMode = $settings['points_calculation_mode'] ?? 'capped';

        $checkOrderStmt = $pdo->prepare("SELECT 1 FROM shopee_loyalty_orders WHERE order_id = ? AND company_id = ?");
        $insertOrderStmt = $pdo->prepare("INSERT INTO shopee_loyalty_orders (order_id, shopee_username, order_date, total_amount, points_earned, company_id) VALUES (?, ?, ?, ?, ?, ?)");
        
        $getMemberStmt = $pdo->prepare("SELECT id, total_points FROM shopee_loyalty_members WHERE shopee_username = ? AND company_id = ?");
        $insertMemberStmt = $pdo->prepare("INSERT INTO shopee_loyalty_members (shopee_username, total_points, company_id) VALUES (?, ?, ?)");
        $updateMemberStmt = $pdo->prepare("UPDATE shopee_loyalty_members SET total_points = total_points + ? WHERE shopee_username = ? AND company_id = ?");

        $insertCouponStmt = $pdo->prepare("INSERT INTO loyalty_coupons (code, shopee_username, discount_value, min_spend, expiry_date, company_id) VALUES (?, ?, ?, ?, ?, ?)");
        $countCouponStmt = $pdo->prepare("SELECT COUNT(*) FROM loyalty_coupons WHERE shopee_username = ? AND company_id = ?");

        $checkItemStmt = $pdo->prepare("SELECT 1 FROM shopee_loyalty_order_items WHERE order_id = ? AND sku_reference = ? AND variation_name = ?");
        $insertItemStmt = $pdo->prepare("INSERT INTO shopee_loyalty_order_items (order_id, sku_reference, variation_name) VALUES (?, ?, ?)");
        $updateCouponUsageStmt = $pdo->prepare("UPDATE loyalty_coupons SET status = 'used', used_at = NOW(), used_in_order_id = ? WHERE code = ? AND company_id = ? AND (status = 'active' OR used_in_order_id = ?)");

        foreach ($orders as $order) {
            $orderId = $order['order_id'];
            $username = $order['username'];
            $status = $order['status'];
            $amount = (float) $order['total_amount'];
            $orderDate = parse_flexible_datetime($order['order_date']);
            $skuRef = $order['sku_reference'] ?? '';
            $variationName = $order['variation_name'] ?? '';
            $couponCodesStr = $order['coupon_codes'] ?? '';
            
            // LOGGING
            file_put_contents(__DIR__ . '/coupon_debug.log', date('Y-m-d H:i:s') . " Order: $orderId, Username: $username, Received Coupon: '$couponCodesStr'\n", FILE_APPEND);

            // Check if valid status
            if ($status !== 'สำเร็จแล้ว' && $status !== 'Completed') {
                continue;
            }

            // Process Items
            if ($skuRef || $variationName) {
                $checkItemStmt->execute([$orderId, $skuRef, $variationName]);
                if (!$checkItemStmt->fetchColumn()) {
                    $insertItemStmt->execute([$orderId, $skuRef, $variationName]);
                }
            }

            // Process Coupons
            if ($couponCodesStr) {
                $codes = explode(';', $couponCodesStr);
                foreach ($codes as $c) {
                    // Remove any invisible characters (like non-breaking spaces from copy-paste)
                    $c = strtoupper(preg_replace('/[^A-Z0-9]/i', '', $c));
                    if ($c) {
                        $res = $updateCouponUsageStmt->execute([$orderId, $c, $companyId, $orderId]);
                        file_put_contents(__DIR__ . '/coupon_debug.log', date('Y-m-d H:i:s') . " Updated Coupon '$c' for Order '$orderId', Result: " . ($res ? 'true' : 'false') . ", Affected: " . $updateCouponUsageStmt->rowCount() . "\n", FILE_APPEND);
                    }
                }
            }

            // Check if already processed
            $checkOrderStmt->execute([$orderId, $companyId]);
            if ($checkOrderStmt->fetchColumn()) {
                continue;
            }

            // Calculate points
            if ($calculationMode === 'proportional') {
                $pointsEarned = floor($amount / $spendPerPoint);
            } else {
                $pointsEarned = ($amount >= $spendPerPoint) ? 1 : 0;
            }
            
            // We insert all valid completed orders to calculate AOV & Repeat Rate later
            $insertOrderStmt->execute([$orderId, $username, $orderDate, $amount, $pointsEarned, $companyId]);
            $importedCount++;

            // Only update member points if points earned > 0
            if ($pointsEarned > 0) {
                $getMemberStmt->execute([$username, $companyId]);
                $member = $getMemberStmt->fetch(PDO::FETCH_ASSOC);

                $currentPoints = 0;
                if ($member) {
                    $updateMemberStmt->execute([$pointsEarned, $username, $companyId]);
                    $currentPoints = (int)$member['total_points'] + $pointsEarned;
                } else {
                    $insertMemberStmt->execute([$username, $pointsEarned, $companyId]);
                    $currentPoints = $pointsEarned;
                }

                // Check how many coupons the user should have based on their total points
                $expectedCoupons = floor($currentPoints / $pointsForCoupon);
                
                $countCouponStmt->execute([$username, $companyId]);
                $actualCoupons = (int)$countCouponStmt->fetchColumn();

                $couponsToGenerate = $expectedCoupons - $actualCoupons;

                for ($i = 0; $i < $couponsToGenerate; $i++) {
                    $couponCode = $couponPrefix . strtoupper(bin2hex(random_bytes(3)));
                    $expiryDate = date('Y-m-d H:i:s', strtotime("+{$couponExpiryDays} days"));
                    
                    $inserted = false;
                    while (!$inserted) {
                        try {
                            $insertCouponStmt->execute([$couponCode, $username, $couponDiscount, $couponMinSpend, $expiryDate, $companyId]);
                            $inserted = true;
                        } catch (PDOException $e) {
                            if ($e->getCode() == 23000) { // Duplicate entry
                                $couponCode = $couponPrefix . strtoupper(bin2hex(random_bytes(3)));
                            } else {
                                throw $e;
                            }
                        }
                    }
                    $couponsGenerated++;
                }
            } else {
                // Member might not exist, but we should create them with 0 points if they don't exist
                $getMemberStmt->execute([$username, $companyId]);
                if (!$getMemberStmt->fetchColumn()) {
                    $insertMemberStmt->execute([$username, 0, $companyId]);
                }
            }
        }

        $pdo->commit();
        clear_dashboard_cache($companyId);
        json_response(['ok' => true, 'imported' => $importedCount, 'couponsGenerated' => $couponsGenerated]);
    } catch (Exception $e) {
        $pdo->rollBack();
        json_response(['error' => 'Import failed', 'message' => $e->getMessage()], 500);
    }
}

function handle_get_members(PDO $pdo, int $companyId): void
{
    $stmt = $pdo->prepare("
        SELECT m.shopee_username, m.total_points, m.created_at,
               (SELECT COUNT(*) FROM loyalty_coupons c WHERE c.shopee_username = m.shopee_username AND c.company_id = m.company_id) as coupons_count,
               (SELECT c.code FROM loyalty_coupons c WHERE c.shopee_username = m.shopee_username AND c.company_id = m.company_id ORDER BY c.id DESC LIMIT 1) as latest_coupon,
               (SELECT SUM(o.total_amount) FROM shopee_loyalty_orders o WHERE o.shopee_username = m.shopee_username AND o.company_id = m.company_id) as total_spent
        FROM shopee_loyalty_members m
        WHERE m.company_id = ?
        ORDER BY m.total_points DESC, m.created_at DESC
    ");
    $stmt->execute([$companyId]);
    json_response(['members' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
}

function handle_get_member_orders(PDO $pdo, int $companyId): void
{
    $username = $_GET['username'] ?? '';
    if (!$username) {
        json_response(['error' => 'Missing username'], 400);
    }

    $stmt = $pdo->prepare("
        SELECT o.order_id, o.order_date, o.total_amount, o.points_earned,
               GROUP_CONCAT(
                   CONCAT(i.sku_reference, CASE WHEN i.variation_name != '' AND i.variation_name IS NOT NULL AND i.variation_name != 'Default' THEN CONCAT(' (', i.variation_name, ')') ELSE '' END)
                   SEPARATOR '||'
               ) as items_summary
        FROM shopee_loyalty_orders o
        LEFT JOIN shopee_loyalty_order_items i ON o.order_id = i.order_id
        WHERE o.shopee_username = ? AND o.company_id = ?
        GROUP BY o.order_id, o.order_date, o.total_amount, o.points_earned
        ORDER BY o.order_date DESC
    ");
    $stmt->execute([$username, $companyId]);
    json_response(['orders' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
}

function handle_dashboard_stats(PDO $pdo, int $companyId): void
{
    $cached = get_dashboard_cache($companyId);
    if ($cached) {
        $cached['settings'] = get_shopee_loyalty_settings($pdo, $companyId);
        json_response($cached);
        exit;
    }

    $settings = get_shopee_loyalty_settings($pdo, $companyId);
    
    // AOV
    $stmtAov = $pdo->prepare("SELECT AVG(total_amount) as aov, SUM(total_amount) as total_sales FROM shopee_loyalty_orders WHERE company_id = ?");
    $stmtAov->execute([$companyId]);
    $salesData = $stmtAov->fetch(PDO::FETCH_ASSOC);
    $aov = $salesData['aov'] ? round($salesData['aov'], 2) : 0;
    $totalSales = $salesData['total_sales'] ? round($salesData['total_sales'], 2) : 0;

    // Repeat Rate
    $stmtUsers = $pdo->prepare("
        SELECT 
            COUNT(DISTINCT shopee_username) as total_users,
            SUM(CASE WHEN order_count > 1 THEN 1 ELSE 0 END) as returning_users
        FROM (
            SELECT shopee_username, COUNT(*) as order_count 
            FROM shopee_loyalty_orders 
            WHERE company_id = ? 
            GROUP BY shopee_username
        ) as user_orders
    ");
    $stmtUsers->execute([$companyId]);
    $usersData = $stmtUsers->fetch(PDO::FETCH_ASSOC);
    $totalUsers = (int)$usersData['total_users'];
    $returningUsers = (int)$usersData['returning_users'];
    $repeatRate = $totalUsers > 0 ? round(($returningUsers / $totalUsers) * 100, 2) : 0;

    // Members with > 0 points
    $stmtPoints = $pdo->prepare("SELECT COUNT(*) FROM shopee_loyalty_members WHERE total_points > 0 AND company_id = ?");
    $stmtPoints->execute([$companyId]);
    $membersWithPoints = (int)$stmtPoints->fetchColumn();

    // Members with >= 10 points
    $stmt10Points = $pdo->prepare("SELECT COUNT(*) FROM shopee_loyalty_members WHERE total_points >= 10 AND company_id = ?");
    $stmt10Points->execute([$companyId]);
    $membersWith10Points = (int)$stmt10Points->fetchColumn();
    
    // Total Company Sales (to calculate %)
    $stmtTotalSales = $pdo->prepare("SELECT SUM(total_amount) FROM orders WHERE company_id = ? AND order_status IN ('Completed', 'สำเร็จแล้ว', 'Delivered')");
    $stmtTotalSales->execute([$companyId]);
    $companySales = (float)$stmtTotalSales->fetchColumn();
    if ($companySales <= 0) $companySales = 1.0;
    
    $salesPercent = round(($totalSales / $companySales) * 100, 2);

    $response = [
        'stats' => [
            'aov' => $aov,
            'repeat_rate' => $repeatRate,
            'members_with_points' => $membersWithPoints,
            'members_10_points' => $membersWith10Points,
            'member_sales' => $totalSales,
            'total_members' => $totalUsers,
            'member_sales_percent' => $salesPercent,
            'company_sales' => $companySales
        ]
    ];
    
    set_dashboard_cache($companyId, $response);
    
    $response['settings'] = $settings;
    json_response($response);
}

function handle_get_member_coupons(PDO $pdo, int $companyId): void
{
    $username = $_GET['username'] ?? '';
    if (!$username) {
        json_response(['error' => 'Missing username'], 400);
    }
    
    $stmt = $pdo->prepare("
        SELECT id, code, discount_value, min_spend, expiry_date, status, created_at, used_at 
        FROM loyalty_coupons 
        WHERE shopee_username = ? AND company_id = ?
        ORDER BY created_at DESC
    ");
    $stmt->execute([$username, $companyId]);
    json_response(['coupons' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
}

function handle_update_coupon(PDO $pdo, int $companyId): void
{
    $input = json_decode(file_get_contents('php://input'), true);
    $couponId = $input['coupon_id'] ?? 0;
    $status = $input['status'] ?? '';
    
    if (!$couponId || !in_array($status, ['active', 'used'])) {
        json_response(['error' => 'Invalid parameters'], 400);
    }
    
    $stmt = $pdo->prepare("UPDATE loyalty_coupons SET status = ?, used_at = IF(? = 'used', NOW(), NULL) WHERE id = ? AND company_id = ?");
    $stmt->execute([$status, $status, $couponId, $companyId]);
    
    json_response(['ok' => true]);
}

function get_dashboard_cache(int $companyId): ?array
{
    $cacheFile = __DIR__ . '/cache/loyalty_stats_' . $companyId . '.json';
    if (file_exists($cacheFile)) {
        $mtime = filemtime($cacheFile);
        if (time() - $mtime < 900) { // 15 minutes TTL
            $content = file_get_contents($cacheFile);
            $data = json_decode($content, true);
            if ($data) return $data;
        }
    }
    return null;
}

function set_dashboard_cache(int $companyId, array $data): void
{
    $cacheFile = __DIR__ . '/cache/loyalty_stats_' . $companyId . '.json';
    file_put_contents($cacheFile, json_encode($data));
}

function clear_dashboard_cache(int $companyId): void
{
    $cacheFile = __DIR__ . '/cache/loyalty_stats_' . $companyId . '.json';
    if (file_exists($cacheFile)) {
        unlink($cacheFile);
    }
}
