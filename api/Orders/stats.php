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

    // 1. Overall Stats
    // Exclude 'Cancelled' from revenue calculations if desired, but usually totalOrders includes everything or specific statuses.
    // Adjusting logic: Total Orders (All), Revenue (Payment Status = Paid or specific logic?), Avg Order Value.
    // For simplicity and matching typical dashboards:
    // Total Orders: Count of all orders (maybe excluding cancelled?) -> User simplified view usually implies all or valid.
    // Let's assume all for count, but revenue might need to be 'Paid' or 'Completed'? 
    // Looking at previous AdminDashboard logic:
    // const totalRevenue = orders.reduce((sum, order) => sum + order.totalAmount, 0); 
    // It summed EVERYTHING in the loaded list. I will replicate that behavior for consistency.
    
    $stmtOverall = $pdo->prepare("
        SELECT 
            COUNT(*) as totalOrders, 
            COALESCE(SUM(total_amount), 0) as totalRevenue 
        FROM orders 
        WHERE company_id = ?
    ");
    $stmtOverall->execute([$companyId]);
    $overall = $stmtOverall->fetch(PDO::FETCH_ASSOC);
    
    $totalOrders = (int)$overall['totalOrders'];
    $totalRevenue = (float)$overall['totalRevenue'];
    $avgOrderValue = $totalOrders > 0 ? $totalRevenue / $totalOrders : 0;

    // 2. Status Breakdown
    // o.order_status
    $stmtStatus = $pdo->prepare("
        SELECT order_status, COUNT(*) as count 
        FROM orders 
        WHERE company_id = ? 
        GROUP BY order_status
    ");
    $stmtStatus->execute([$companyId]);
    $statusCounts = $stmtStatus->fetchAll(PDO::FETCH_KEY_PAIR); // ['Pending' => 5, 'Confirmed' => 3]

    // 3. Monthly Counts (Last 12 months)
    // Group by YYYY-MM
    $stmtMonthly = $pdo->prepare("
        SELECT 
            DATE_FORMAT(order_date, '%Y-%m') as month_key, 
            COUNT(*) as count 
        FROM orders 
        WHERE company_id = ? 
          AND order_date >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
        GROUP BY month_key 
        ORDER BY month_key ASC
    ");
    $stmtMonthly->execute([$companyId]);
    $monthlyRaw = $stmtMonthly->fetchAll(PDO::FETCH_ASSOC);
    
    // Format for chart: usually we want a continuous list or just the raw data.
    // Client side often handles filling gaps, but let's return the raw list first.
    $monthlyCounts = [];
    foreach ($monthlyRaw as $row) {
        $monthlyCounts[$row['month_key']] = (int)$row['count'];
    }

    echo json_encode([
        'ok' => true,
        'stats' => [
            'totalOrders' => $totalOrders,
            'totalRevenue' => $totalRevenue,
            'avgOrderValue' => $avgOrderValue,
            'statusCounts' => $statusCounts,
            'monthlyCounts' => $monthlyCounts
        ]
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}
