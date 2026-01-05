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
    $filterWhere = "WHERE company_id = ?";
    $filterParams = [$companyId];

    // Add user filter if provided (for user-specific stats)
    if ($userId > 0) {
        $filterWhere .= " AND creator_id = ?";
        $filterParams[] = $userId;
    }

    if ($year) {
        $filterWhere .= " AND YEAR(order_date) = ?";
        $filterParams[] = $year;
        if ($month) {
            $filterWhere .= " AND MONTH(order_date) = ?";
            $filterParams[] = $month;
        }
    }

    // 1. Overall/Filtered Stats
    $stmtOverall = $pdo->prepare("
        SELECT 
            COUNT(*) as totalOrders, 
            COALESCE(SUM(total_amount), 0) as totalRevenue 
        FROM orders 
        $filterWhere
    ");
    $stmtOverall->execute($filterParams);
    $overall = $stmtOverall->fetch(PDO::FETCH_ASSOC);
    
    $totalOrders = (int)$overall['totalOrders'];
    $totalRevenue = (float)$overall['totalRevenue'];
    $avgOrderValue = $totalOrders > 0 ? $totalRevenue / $totalOrders : 0;

    // 2. Status Breakdown (Filtered)
    $stmtStatus = $pdo->prepare("
        SELECT order_status, COUNT(*) as count 
        FROM orders 
        $filterWhere 
        GROUP BY order_status
    ");
    $stmtStatus->execute($filterParams);
    $statusCounts = $stmtStatus->fetchAll(PDO::FETCH_KEY_PAIR);

    // 3. Payment Method Counts (Filtered) - Needed for SalesDashboard
    // Mapping: 'COD' -> 'COD', 'Transfer' -> 'Transfer' (or whatever DB values are)
    $stmtPayment = $pdo->prepare("
        SELECT payment_method, COUNT(*) as count 
        FROM orders 
        $filterWhere 
        GROUP BY payment_method
    ");
    $stmtPayment->execute($filterParams);
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

    echo json_encode([
        'ok' => true,
        'filter' => [
            'month' => $month,
            'year' => $year
        ],
        'stats' => [
            'totalOrders' => $totalOrders,
            'totalRevenue' => $totalRevenue,
            'avgOrderValue' => $avgOrderValue,
            'statusCounts' => $statusCounts,
            'paymentMethodCounts' => $paymentMethodCounts,
            'monthlyCounts' => $monthlyCounts
        ]
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}
