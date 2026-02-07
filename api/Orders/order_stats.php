<?php
ini_set('display_errors', 1);
error_reporting(E_ALL);

require_once __DIR__ . '/../config.php';

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Max-Age: 3600");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

try {
    $pdo = db_connect();
    
    // validate_auth($pdo);

    $companyId = isset($_GET['company_id']) ? (int)$_GET['company_id'] : 0;

    if ($companyId <= 0) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid company_id']);
        exit();
    }

    // Parameters
    $month = isset($_GET['month']) ? (int)$_GET['month'] : null;
    $year = isset($_GET['year']) ? (int)$_GET['year'] : null;
    $userId = isset($_GET['user_id']) ? (int)$_GET['user_id'] : null;

    // Base filtering for "Summary" cards (Orders, Revenue, Status, Payment)
    // If AdminDashboard calls without filters -> All Time
    // If SalesDashboard calls with filters -> Filtered
    
    // Build date filter
    $dateFilter = "";
    $dateParams = [];
    if ($year) {
        $dateFilter = " AND YEAR(o.order_date) = ?";
        $dateParams[] = $year;
        if ($month) {
            $dateFilter .= " AND MONTH(o.order_date) = ?";
            $dateParams[] = $month;
        }
    }

    // NOTE: We now use oi.creator_id for filtering so upsell items are included
    // Regular sale: o.creator_id = user, oi.creator_id = user
    // Upsell: o.creator_id = other_user, oi.creator_id = user (we still count these)
    
    // 1. Overall/Filtered Stats - Using order_items to include upsell
    if ($userId > 0) {
        // User-specific stats using order_items (includes upsell)
        $stmtOverall = $pdo->prepare("
            SELECT 
                COUNT(DISTINCT o.id) as totalOrders, 
                COALESCE(SUM(CASE WHEN o.order_status NOT IN ('Cancelled', 'Returned', 'BadDebt') 
                    THEN COALESCE(oi.net_total, oi.quantity * oi.price_per_unit) ELSE 0 END), 0) as totalRevenue,
                COUNT(DISTINCT CASE WHEN o.order_status = 'Cancelled' THEN o.id END) as totalCancelOrderCount
            FROM order_items oi
            JOIN orders o ON oi.parent_order_id = o.id
            WHERE o.company_id = ?
            AND oi.creator_id = ?
            AND (oi.is_freebie = 0 OR oi.is_freebie IS NULL)
            $dateFilter
        ");
        $filterParams = array_merge([$companyId, $userId], $dateParams);
    } else {
        // Company-wide stats (admin view) using orders table
        $stmtOverall = $pdo->prepare("
            SELECT 
                COUNT(*) as totalOrders, 
                COALESCE(SUM(CASE WHEN order_status NOT IN ('Cancelled', 'Returned') THEN total_amount ELSE 0 END), 0) as totalRevenue,
                COUNT(CASE WHEN order_status = 'Cancelled' THEN 1 END) as totalCancelOrderCount
            FROM orders o
            WHERE o.company_id = ?
            $dateFilter
        ");
        $filterParams = array_merge([$companyId], $dateParams);
    }
    
    $stmtOverall->execute($filterParams);
    $overall = $stmtOverall->fetch(PDO::FETCH_ASSOC);
    
    $totalOrders = (int)$overall['totalOrders'];
    $totalRevenue = (float)$overall['totalRevenue'];
    $totalCancelOrderCount = (int)$overall['totalCancelOrderCount'];
    
    $validOrderCount = max(1, $totalOrders - $totalCancelOrderCount);
    $avgOrderValue = $totalRevenue / $validOrderCount;

    // ========================================
    // Upsell Stats: Items added by this user to orders created by OTHER users
    // ========================================
    $upsellRevenue = 0;
    $upsellOrders = 0;
    $upsellQuantity = 0;
    
    if ($userId > 0) {
        $upsellWhere = "WHERE o.company_id = ? AND o.order_status NOT IN ('Cancelled', 'Returned', 'BadDebt')";
        $upsellParams = [$companyId];
        
        if ($year) {
            $upsellWhere .= " AND YEAR(o.order_date) = ?";
            $upsellParams[] = $year;
            if ($month) {
                $upsellWhere .= " AND MONTH(o.order_date) = ?";
                $upsellParams[] = $month;
            }
        }
        
        // Upsell = items where creator_id = user but order creator is different
        $upsellWhere .= " AND oi.creator_id = ? AND o.creator_id != ?";
        $upsellParams[] = $userId;
        $upsellParams[] = $userId;
        
        $stmtUpsell = $pdo->prepare("
            SELECT 
                COUNT(DISTINCT o.id) as upsell_orders,
                COALESCE(SUM(COALESCE(oi.net_total, oi.quantity * oi.price_per_unit)), 0) as upsell_revenue,
                COALESCE(SUM(oi.quantity), 0) as upsell_quantity
            FROM orders o
            JOIN order_items oi ON oi.parent_order_id = o.id
            $upsellWhere
            AND (oi.is_freebie = 0 OR oi.is_freebie IS NULL)
        ");
        $stmtUpsell->execute($upsellParams);
        $upsellRow = $stmtUpsell->fetch(PDO::FETCH_ASSOC);
        
        $upsellRevenue = (float)($upsellRow['upsell_revenue'] ?? 0);
        $upsellOrders = (int)($upsellRow['upsell_orders'] ?? 0);
        $upsellQuantity = (int)($upsellRow['upsell_quantity'] ?? 0);
    }

    // Build filterWhere for status/payment queries
    $filterWhere = "WHERE o.company_id = ? $dateFilter";
    if ($userId > 0) {
        $filterWhere .= " AND o.creator_id = ?";
        $filterParamsWithUser = array_merge([$companyId], $dateParams, [$userId]);
    } else {
        $filterParamsWithUser = array_merge([$companyId], $dateParams);
    }

    $stmtStatus = $pdo->prepare("
        SELECT order_status, COUNT(*) as count 
        FROM orders o
        $filterWhere 
        GROUP BY order_status
    ");
    $stmtStatus->execute($filterParamsWithUser);
    $statusCounts = $stmtStatus->fetchAll(PDO::FETCH_KEY_PAIR);

    // 3. Payment Method Counts (Filtered) - Needed for SalesDashboard
    // Exclude cancelled/returned/baddebt orders to match active order counts
    $stmtPayment = $pdo->prepare("
        SELECT payment_method, COUNT(*) as count 
        FROM orders o
        $filterWhere 
        AND o.order_status NOT IN ('Cancelled', 'Returned', 'BadDebt')
        GROUP BY payment_method
    ");
    $stmtPayment->execute($filterParamsWithUser);
    $paymentMethodCounts = $stmtPayment->fetchAll(PDO::FETCH_KEY_PAIR);

    // 4. Monthly Counts for Chart (Contextual Trend)
    // If year is selected, maybe show that year's data? 
    // Or just keep Last 12 Months? AdminDashboard likes Last 12.
    // SalesDashboard might prefer the selected year trend.
    // Let's adapt: If Year is provided, show that Year's months. Else Last 12.
    
    $chartParams = [$companyId];
    $userFilter = "";
    if ($userId > 0) {
        $userFilter = " AND creator_id = ?";
    }

    if ($year) {
        $chartSql = "
            SELECT 
                DATE_FORMAT(order_date, '%Y-%m') as month_key, 
                COUNT(*) as count 
            FROM orders 
            WHERE company_id = ? 
              AND YEAR(order_date) = ?
              $userFilter
            GROUP BY month_key 
            ORDER BY month_key ASC
        ";
        $chartParams[] = $year;
        if ($userId > 0) $chartParams[] = $userId;
    } else {
        $chartSql = "
            SELECT 
                DATE_FORMAT(order_date, '%Y-%m') as month_key, 
                COUNT(*) as count 
            FROM orders 
            WHERE company_id = ? 
              AND order_date >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
              $userFilter
            GROUP BY month_key 
            ORDER BY month_key ASC
        ";
        if ($userId > 0) $chartParams[] = $userId;
    }

    $stmtMonthly = $pdo->prepare($chartSql);
    $stmtMonthly->execute($chartParams);
    $monthlyRaw = $stmtMonthly->fetchAll(PDO::FETCH_ASSOC);
    
    $monthlyCounts = [];
    foreach ($monthlyRaw as $row) {
        $monthlyCounts[$row['month_key']] = (int)$row['count'];
    }

    // ========================================
    // 5. Monthly SALES for Chart Toggle
    // Uses same logic as telesale_performance for consistency
    // ========================================
    $salesParams = [$companyId];
    $salesUserFilter = "";
    if ($userId > 0) {
        $salesUserFilter = " AND oi.creator_id = ?";
    }

    if ($year) {
        $salesSql = "
            SELECT 
                DATE_FORMAT(o.order_date, '%Y-%m') as month_key, 
                COALESCE(SUM(COALESCE(oi.net_total, oi.quantity * oi.price_per_unit)), 0) as sales
            FROM order_items oi
            JOIN orders o ON oi.parent_order_id = o.id
            WHERE o.company_id = ? 
              AND YEAR(o.order_date) = ?
              AND o.order_status NOT IN ('Cancelled', 'Returned', 'BadDebt')
              AND (oi.is_freebie = 0 OR oi.is_freebie IS NULL)
              $salesUserFilter
            GROUP BY month_key 
            ORDER BY month_key ASC
        ";
        $salesParams[] = $year;
        if ($userId > 0) $salesParams[] = $userId;
    } else {
        $salesSql = "
            SELECT 
                DATE_FORMAT(o.order_date, '%Y-%m') as month_key, 
                COALESCE(SUM(COALESCE(oi.net_total, oi.quantity * oi.price_per_unit)), 0) as sales
            FROM order_items oi
            JOIN orders o ON oi.parent_order_id = o.id
            WHERE o.company_id = ? 
              AND o.order_date >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
              AND o.order_status NOT IN ('Cancelled', 'Returned', 'BadDebt')
              AND (oi.is_freebie = 0 OR oi.is_freebie IS NULL)
              $salesUserFilter
            GROUP BY month_key 
            ORDER BY month_key ASC
        ";
        if ($userId > 0) $salesParams[] = $userId;
    }

    $stmtMonthlySales = $pdo->prepare($salesSql);
    $stmtMonthlySales->execute($salesParams);
    $monthlySalesRaw = $stmtMonthlySales->fetchAll(PDO::FETCH_ASSOC);
    
    $monthlySales = [];
    foreach ($monthlySalesRaw as $row) {
        $monthlySales[$row['month_key']] = (float)$row['sales'];
    }

    echo json_encode([
        'ok' => true,
        'filter' => [
            'month' => $month,
            'year' => $year
        ],
        'stats' => [
            'totalOrders' => $totalOrders,
            'totalRevenue' => $totalRevenue,
            'totalCancelOrderCount' => $totalCancelOrderCount,
            'avgOrderValue' => $avgOrderValue,
            'statusCounts' => $statusCounts,
            'paymentMethodCounts' => $paymentMethodCounts,
            'monthlyCounts' => $monthlyCounts,
            'monthlySales' => $monthlySales,  // ★ NEW: Monthly sales for chart toggle
            // Upsell: sales from items added to OTHER users' orders
            'upsellRevenue' => $upsellRevenue,
            'upsellOrders' => $upsellOrders,
            'upsellQuantity' => $upsellQuantity
        ]
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}
