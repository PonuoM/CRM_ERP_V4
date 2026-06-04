<?php
require_once __DIR__ . '/../config.php';

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

try {
    $pdo = db_connect();

    $companyId = isset($_GET['company_id']) ? (int) $_GET['company_id'] : 0;
    $page = isset($_GET['page']) ? max(1, (int) $_GET['page']) : 1;
    $pageSize = isset($_GET['page_size']) ? min(5000, max(10, (int) $_GET['page_size'])) : 20;
    $offset = ($page - 1) * $pageSize;

    if ($companyId <= 0) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Invalid company_id']);
        exit();
    }

    // Count total unclassified cancelled orders
    $countStmt = $pdo->prepare("
        SELECT COUNT(*) as total
        FROM orders o
        LEFT JOIN order_cancellations oc ON oc.order_id = o.id
        WHERE o.company_id = ?
        AND o.order_status = 'Cancelled'
        AND oc.id IS NULL
    ");
    $countStmt->execute([$companyId]);
    $total = (int) $countStmt->fetch(PDO::FETCH_ASSOC)['total'];

    // Count already classified
    $classifiedStmt = $pdo->prepare("
        SELECT COUNT(*) as classified
        FROM orders o
        INNER JOIN order_cancellations oc ON oc.order_id = o.id
        WHERE o.company_id = ?
        AND o.order_status = 'Cancelled'
    ");
    $classifiedStmt->execute([$companyId]);
    $classified = (int) $classifiedStmt->fetch(PDO::FETCH_ASSOC)['classified'];

    // Fetch unclassified cancelled orders
    $stmt = $pdo->prepare("
        SELECT 
            o.id as order_id,
            o.order_date,
            o.total_amount,
            o.customer_id,
            o.creator_id,
            CONCAT(c.first_name, ' ', c.last_name) as customer_name,
            c.phone as customer_phone,
            CONCAT(u.first_name, ' ', u.last_name) as creator_name
        FROM orders o
        LEFT JOIN order_cancellations oc ON oc.order_id = o.id
        LEFT JOIN customers c ON c.customer_id = o.customer_id
        LEFT JOIN users u ON u.id = o.creator_id
        WHERE o.company_id = ?
        AND o.order_status = 'Cancelled'
        AND oc.id IS NULL
        ORDER BY o.order_date DESC
        LIMIT ? OFFSET ?
    ");
    $stmt->execute([$companyId, $pageSize, $offset]);
    $cancelledOrders = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Get cancellation type IDs
    $typeStmt = $pdo->prepare("SELECT id, label FROM cancellation_types WHERE is_active = 1 ORDER BY sort_order");
    $typeStmt->execute();
    $types = $typeStmt->fetchAll(PDO::FETCH_ASSOC);
    $typeMap = [];
    foreach ($types as $t) {
        $typeMap[$t['label']] = (int) $t['id'];
    }
    // Fallback to first/second active type if labels don't match
    $fallbackId1 = isset($types[0]) ? (int) $types[0]['id'] : 1;
    $fallbackId2 = isset($types[1]) ? (int) $types[1]['id'] : $fallbackId1;
    $beforeSystemId = $typeMap['ยกเลิกก่อนเข้าระบบ'] ?? $fallbackId1;
    $afterSystemId = $typeMap['ยกเลิกหลังเข้าระบบ'] ?? $fallbackId2;

    // Prepare related orders in a single query to avoid N+1 problem
    $customerIds = [];
    $minDateStr = null;
    $maxDateStr = null;
    foreach ($cancelledOrders as $order) {
        $customerIds[] = $order['customer_id'];
        $ts = strtotime($order['order_date']);
        if ($minDateStr === null || $ts < strtotime($minDateStr)) $minDateStr = $order['order_date'];
        if ($maxDateStr === null || $ts > strtotime($maxDateStr)) $maxDateStr = $order['order_date'];
    }

    $relatedOrdersGrouped = [];
    if (!empty($customerIds)) {
        $customerIds = array_unique($customerIds);
        $inPlaceholders = implode(',', array_fill(0, count($customerIds), '?'));
        
        // Calculate date range buffer (+/- 7 days)
        $minDate = date('Y-m-d 00:00:00', strtotime($minDateStr . ' -7 days'));
        $maxDate = date('Y-m-d 23:59:59', strtotime($maxDateStr . ' +7 days'));
        
        $relatedParams = array_merge([$companyId, $minDate, $maxDate], array_values($customerIds));
        
        // Use BETWEEN instead of ABS(DATEDIFF()) for index utilization
        $relatedStmt = $pdo->prepare("
            SELECT 
                o2.id as order_id,
                o2.order_date,
                o2.total_amount,
                o2.order_status,
                o2.customer_id,
                CONCAT(u.first_name, ' ', u.last_name) as creator_name
            FROM orders o2
            LEFT JOIN users u ON u.id = o2.creator_id
            WHERE o2.company_id = ?
            AND o2.order_status != 'Cancelled'
            AND o2.order_date BETWEEN ? AND ?
            AND o2.customer_id IN ($inPlaceholders)
        ");
        $relatedStmt->execute($relatedParams);
        $allRelated = $relatedStmt->fetchAll(PDO::FETCH_ASSOC);
        
        foreach ($allRelated as $r) {
            $relatedOrdersGrouped[$r['customer_id']][] = $r;
        }
    }

    // Analyze each cancelled order
    $results = [];
    foreach ($cancelledOrders as $order) {
        $customerRelated = $relatedOrdersGrouped[$order['customer_id']] ?? [];
        
        $relatedOrders = [];
        $orderTs = strtotime($order['order_date']);
        foreach ($customerRelated as $r) {
            if ($r['order_id'] === $order['order_id']) continue;
            
            $rTs = strtotime($r['order_date']);
            $diffDays = abs($rTs - $orderTs) / 86400;
            
            if ($diffDays <= 7) {
                $r['diff_days'] = $diffDays;
                $relatedOrders[] = $r;
            }
        }
        
        // Sort by closest date
        usort($relatedOrders, function($a, $b) {
            return $a['diff_days'] <=> $b['diff_days'];
        });
        
        // Limit to top 5
        $relatedOrders = array_slice($relatedOrders, 0, 5);

        $hasRelated = count($relatedOrders) > 0;

        // Determine confidence
        if ($hasRelated) {
            $closestDaysDiff = $relatedOrders[0]['diff_days'];
            $confidence = $closestDaysDiff <= 1 ? 'high' : ($closestDaysDiff <= 3 ? 'medium' : 'low');
        } else {
            $confidence = 'medium';
        }

        $results[] = [
            'order_id' => $order['order_id'],
            'order_date' => $order['order_date'],
            'customer_name' => $order['customer_name'],
            'customer_phone' => $order['customer_phone'],
            'total_amount' => (float) $order['total_amount'],
            'creator_name' => $order['creator_name'],
            'suggested_type_id' => $hasRelated ? $beforeSystemId : $afterSystemId,
            'suggested_type_label' => $hasRelated ? 'ยกเลิกก่อนเข้าระบบ' : 'ยกเลิกหลังเข้าระบบ',
            'confidence' => $confidence,
            'related_orders' => array_map(function ($r) {
                return [
                    'order_id' => $r['order_id'],
                    'order_date' => $r['order_date'],
                    'total_amount' => (float) $r['total_amount'],
                    'order_status' => $r['order_status'],
                    'creator_name' => $r['creator_name'],
                ];
            }, $relatedOrders),
        ];
    }

    echo json_encode([
        'status' => 'success',
        'data' => $results,
        'summary' => [
            'total_cancelled' => $total + $classified,
            'classified' => $classified,
            'unclassified' => $total,
        ],
        'pagination' => [
            'page' => $page,
            'page_size' => $pageSize,
            'total' => $total,
            'total_pages' => ceil($total / $pageSize),
        ]
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
?>
