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

    // Required parameters
    $companyId = isset($_GET['company_id']) ? (int)$_GET['company_id'] : 0;
    $month = isset($_GET['month']) ? (int)$_GET['month'] : (int)date('m');
    $year = isset($_GET['year']) ? (int)$_GET['year'] : (int)date('Y');
    $groupBy = isset($_GET['group_by']) ? $_GET['group_by'] : 'seller';
    $userId = isset($_GET['user_id']) ? (int)$_GET['user_id'] : null;

    if ($companyId <= 0) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid company_id']);
        exit();
    }

    // Validate group_by parameter
    $validGroupBy = ['role', 'page', 'seller'];
    if (!in_array($groupBy, $validGroupBy)) {
        $groupBy = 'seller';
    }

    $statusFilter = isset($_GET['status_filter']) ? $_GET['status_filter'] : 'all';

    // Calculate days in the selected month
    $daysInMonth = cal_days_in_month(CAL_GREGORIAN, $month, $year);
    $days = [];
    for ($d = 1; $d <= $daysInMonth; $d++) {
        $days[] = str_pad($d, 2, '0', STR_PAD_LEFT);
    }

    // Build base WHERE clause
    $whereClause = "WHERE o.company_id = ? AND YEAR(o.order_date) = ? AND MONTH(o.order_date) = ?";
    $params = [$companyId, $year, $month];

    // Status Filters
    if ($statusFilter === 'delivered') {
        $whereClause .= " AND o.order_status = 'Delivered'";
    } elseif ($statusFilter === 'confirmed') {
        // Confirmed, Picking, Shipping, Delivered (exclude pending/cancelled)
        $whereClause .= " AND o.order_status IN ('Confirmed', 'Preparing', 'Picking', 'Shipping', 'Delivered')";
    } else {
        // All Active (exclude Cancelled/BadDebt)
        $whereClause .= " AND o.order_status NOT IN ('Cancelled', 'BadDebt')";
    }

    // Add user filter for non-admin users
    if ($userId > 0) {
        $whereClause .= " AND o.creator_id = ?";
        $params[] = $userId;
    }

    // Build query based on group_by parameter
    $selectGroup = '';
    $joinClause = '';
    $groupByField = '';

    switch ($groupBy) {
        case 'role':
            $selectGroup = "COALESCE(u.role, 'ไม่ระบุ') as group_name, u.role as group_id";
            $joinClause = "LEFT JOIN users u ON o.creator_id = u.id";
            $groupByField = "u.role";
            break;

        case 'page':
            $selectGroup = "COALESCE(p.name, 'โทรขาย') as group_name, o.sales_channel_page_id as group_id";
            $joinClause = "LEFT JOIN pages p ON o.sales_channel_page_id = p.id";
            $groupByField = "o.sales_channel_page_id";
            break;

        case 'seller':
        default:
            $selectGroup = "CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) as group_name, o.creator_id as group_id";
            $joinClause = "LEFT JOIN users u ON o.creator_id = u.id";
            $groupByField = "o.creator_id";
            break;
    }

    // Query for daily sales grouped by the selected field
    $sql = "
        SELECT 
            $selectGroup,
            DAY(o.order_date) as day_of_month,
            SUM(o.total_amount) as total_sales,
            COUNT(*) as order_count
        FROM orders o
        $joinClause
        $whereClause
        GROUP BY $groupByField, DAY(o.order_date)
        ORDER BY $groupByField, DAY(o.order_date)
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rawData = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Process data into chart format
    $groupedData = [];
    $detailsMap = [];

    foreach ($rawData as $row) {
        $groupId = $row['group_id'] ?? 'unknown';
        $groupName = trim($row['group_name']) ?: 'ไม่ระบุ';
        $dayKey = str_pad($row['day_of_month'], 2, '0', STR_PAD_LEFT);
        $sales = (float)$row['total_sales'];

        if (!isset($groupedData[$groupId])) {
            $groupedData[$groupId] = [
                'name' => $groupName,
                'data' => array_fill(0, $daysInMonth, 0),
                'total' => 0
            ];
            $detailsMap[$groupId] = [
                'id' => $groupId,
                'name' => $groupName,
                'dailySales' => [],
                'total' => 0
            ];
        }

        // data array is 0-indexed (day 1 = index 0)
        $dayIndex = (int)$row['day_of_month'] - 1;
        $groupedData[$groupId]['data'][$dayIndex] = $sales;
        $groupedData[$groupId]['total'] += $sales;
        
        $detailsMap[$groupId]['dailySales'][$dayKey] = $sales;
        $detailsMap[$groupId]['total'] += $sales;
    }

    // Convert to series format for chart
    $series = [];
    foreach ($groupedData as $groupId => $groupInfo) {
        $series[] = [
            'name' => $groupInfo['name'],
            'data' => $groupInfo['data']
        ];
    }

    // Convert details map to array
    $details = array_values($detailsMap);

    // Sort details alphabetically by name (instead of by total)
    usort($details, function($a, $b) {
        return strcmp($a['name'], $b['name']);
    });

    echo json_encode([
        'ok' => true,
        'filter' => [
            'month' => $month,
            'year' => $year,
            'groupBy' => $groupBy
        ],
        'data' => [
            'days' => $days,
            'daysInMonth' => $daysInMonth,
            'series' => $series
        ],
        'details' => $details
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}
