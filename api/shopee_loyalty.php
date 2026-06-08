<?php

function handle_shopee_loyalty(PDO $pdo, ?string $id, ?string $action): void
{
    $method = $_SERVER['REQUEST_METHOD'];

    // Ensure tables exist
    ensure_shopee_loyalty_tables($pdo);

    $user = get_authenticated_user($pdo);
    $companyId = $user['company_id'] ?? null;

    if (!$companyId) {
        json_response(['error' => 'COMPANY_REQUIRED'], 400);
    }

    if ($method === 'POST' && $action === 'import') {
        handle_shopee_import($pdo, $companyId);
    } elseif ($method === 'GET' && $action === 'members') {
        handle_get_members($pdo, $companyId);
    } elseif ($method === 'GET' && $action === 'kpi') {
        handle_get_kpi($pdo, $companyId);
    } else {
        json_response(['error' => 'INVALID_ENDPOINT'], 404);
    }
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

        $checkOrderStmt = $pdo->prepare("SELECT 1 FROM shopee_loyalty_orders WHERE order_id = ? AND company_id = ?");
        $insertOrderStmt = $pdo->prepare("INSERT INTO shopee_loyalty_orders (order_id, shopee_username, order_date, total_amount, points_earned, company_id) VALUES (?, ?, ?, ?, ?, ?)");
        
        $getMemberStmt = $pdo->prepare("SELECT id, total_points FROM shopee_loyalty_members WHERE shopee_username = ? AND company_id = ?");
        $insertMemberStmt = $pdo->prepare("INSERT INTO shopee_loyalty_members (shopee_username, total_points, company_id) VALUES (?, ?, ?)");
        $updateMemberStmt = $pdo->prepare("UPDATE shopee_loyalty_members SET total_points = total_points + ? WHERE shopee_username = ? AND company_id = ?");

        $insertCouponStmt = $pdo->prepare("INSERT INTO loyalty_coupons (code, shopee_username, discount_value, min_spend, expiry_date, company_id) VALUES (?, ?, ?, ?, ?, ?)");

        foreach ($orders as $order) {
            $orderId = $order['order_id'];
            $username = $order['username'];
            $status = $order['status'];
            $amount = (float) $order['total_amount'];
            $orderDate = $order['order_date']; // Expected format: YYYY-MM-DD HH:mm:ss

            // Check if valid status
            if ($status !== 'สำเร็จแล้ว' && $status !== 'Completed') {
                continue;
            }
            
            // Check date >= 2026-07-01
            if (strtotime($orderDate) < strtotime('2026-07-01')) {
                continue;
            }

            // Check if already processed
            $checkOrderStmt->execute([$orderId, $companyId]);
            if ($checkOrderStmt->fetchColumn()) {
                continue;
            }

            // Calculate points: 1 point for 1500+, else 0
            $pointsEarned = ($amount >= 1500) ? 1 : 0;
            
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

                // Check if reached a multiple of 10 for auto coupon
                if ($currentPoints >= 10 && ($currentPoints % 10) === 0) {
                    $couponCode = 'CAT3000' . str_pad((string)mt_rand(1, 9999), 4, '0', STR_PAD_LEFT);
                    $expiryDate = '2026-11-30 23:59:59';
                    
                    $inserted = false;
                    while (!$inserted) {
                        try {
                            $insertCouponStmt->execute([$couponCode, $username, 300.00, 1500.00, $expiryDate, $companyId]);
                            $inserted = true;
                        } catch (PDOException $e) {
                            if ($e->getCode() == 23000) { // Duplicate entry
                                $couponCode = 'CAT3000' . str_pad((string)mt_rand(1, 9999), 4, '0', STR_PAD_LEFT);
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

function handle_get_kpi(PDO $pdo, int $companyId): void
{
    // AOV
    $stmtAov = $pdo->prepare("SELECT AVG(total_amount) as aov, SUM(total_amount) as total_sales FROM shopee_loyalty_orders WHERE company_id = ?");
    $stmtAov->execute([$companyId]);
    $salesData = $stmtAov->fetch(PDO::FETCH_ASSOC);
    $aov = $salesData['aov'] ? round($salesData['aov'], 2) : 0;
    $totalSales = $salesData['total_sales'] ? round($salesData['total_sales'], 2) : 0;

    // Repeat Rate
    // Count customers who have > 1 order
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

    json_response([
        'aov' => $aov,
        'repeatRate' => $repeatRate,
        'membersWithPoints' => $membersWithPoints,
        'membersWith10Points' => $membersWith10Points,
        'totalSales' => $totalSales,
        'totalUsers' => $totalUsers,
    ]);
}
