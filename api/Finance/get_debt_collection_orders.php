<?php
require_once '../config.php';

// Enable CORS using helper
cors();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    json_response(['error' => 'Method not allowed'], 405);
}

try {
    // 1. Connect DB
    $pdo = db_connect();

    // 2. Authentication
    $user = get_authenticated_user($pdo);
    if (!$user) {
        json_response(['error' => 'UNAUTHORIZED', 'message' => 'Invalid or missing token'], 401);
    }

    // 3. Parameters
    $companyId = isset($_GET['companyId']) ? (int)$_GET['companyId'] : ($user['company_id'] ?? 0);
    $mode = $_GET['mode'] ?? 'list'; // 'list' or 'summary'
    $status = $_GET['status'] ?? 'active'; // 'active' or 'completed'
    
    // Pagination (only for list mode)
    $page = max(1, (int)($_GET['page'] ?? 1));
    $pageSize = max(1, (int)($_GET['pageSize'] ?? 50));
    $offset = ($page - 1) * $pageSize;

    // Filters
    $customerName = $_GET['customerName'] ?? null;
    $customerPhone = $_GET['customerPhone'] ?? null;
    $orderId = $_GET['orderId'] ?? null;
    
    // 4. Base Query Construction
    $whereConditions = [];
    $params = [];

    // Core Debt Collection Filters
    $whereConditions[] = "o.payment_status = 'Unpaid'";
    // Exclude sub-orders
    $whereConditions[] = "o.id NOT REGEXP '^.+-[0-9]+$'";
    
    // Status Filter
    if ($status === 'completed') {
        // Show orders that HAVE a complete debt collection record
        $whereConditions[] = "EXISTS (SELECT 1 FROM debt_collection dc_check WHERE dc_check.order_id = o.id AND dc_check.is_complete = 1)";
    } else {
        // Default 'active': Show orders that DO NOT HAVE a complete debt collection record
        $whereConditions[] = "NOT EXISTS (SELECT 1 FROM debt_collection dc_check WHERE dc_check.order_id = o.id AND dc_check.is_complete = 1)";
    }

    if ($companyId > 0) {
        $whereConditions[] = "o.company_id = ?";
        $params[] = $companyId;
    }

    if ($customerName) {
        $whereConditions[] = "(c.first_name LIKE ? OR c.last_name LIKE ? OR CONCAT(c.first_name, ' ', c.last_name) LIKE ?)";
        $nameLike = '%' . $customerName . '%';
        $params[] = $nameLike;
        $params[] = $nameLike;
        $params[] = $nameLike;
    }

    if ($customerPhone) {
        $phoneDigits = preg_replace('/\D/', '', $customerPhone);
        $whereConditions[] = "REPLACE(REPLACE(REPLACE(c.phone, '-', ''), ' ', ''), '(', '') LIKE ?";
        $params[] = '%' . $phoneDigits . '%';
    }

    if ($orderId) {
        $whereConditions[] = "o.id LIKE ?";
        $params[] = '%' . $orderId . '%';
    }

    $whereClause = !empty($whereConditions) ? 'WHERE ' . implode(' AND ', $whereConditions) : '';

    // 5. Execution based on Mode
    if ($mode === 'summary') {
        // Summary Stats
        $sql = "SELECT 
                    COUNT(DISTINCT o.id) as order_count,
                    SUM(
                        o.total_amount - (
                            SELECT COALESCE(SUM(dc.amount_collected), 0) 
                            FROM debt_collection dc 
                            WHERE dc.order_id = o.id
                        )
                    ) as total_remaining_debt
                FROM orders o
                LEFT JOIN customers c ON o.customer_id = c.customer_id
                $whereClause";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);

        json_response([
            'ok' => true,
            'orderCount' => (int)($result['order_count'] ?? 0),
            'totalDebt' => (float)($result['total_remaining_debt'] ?? 0)
        ]);

    } else {
        // List Mode
        
        // Count Total for Pagination
        $countSql = "SELECT COUNT(DISTINCT o.id) FROM orders o 
                     LEFT JOIN customers c ON o.customer_id = c.customer_id 
                     $whereClause";
        $countStmt = $pdo->prepare($countSql);
        $countStmt->execute($params);
        $totalOrders = (int)$countStmt->fetchColumn();
        $totalPages = ceil($totalOrders / $pageSize);

        // Fetch Orders
        $sql = "SELECT 
                    o.id, o.customer_id, o.order_date, o.delivery_date, o.total_amount, o.amount_paid, o.cod_amount,
                    c.first_name, c.last_name, c.phone,
                    (SELECT COUNT(*) FROM debt_collection dc WHERE dc.order_id = o.id) as tracking_count,
                    (SELECT COALESCE(SUM(amount_collected), 0) FROM debt_collection dc WHERE dc.order_id = o.id) as total_debt_collected
                FROM orders o
                LEFT JOIN customers c ON o.customer_id = c.customer_id
                $whereClause
                ORDER BY o.delivery_date ASC, o.order_date ASC
                LIMIT $pageSize OFFSET $offset";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Format Response
        $formattedOrders = array_map(function($order) {
            $totalAmount = (float)$order['total_amount'];
            $paidAmount = (float)($order['amount_paid'] ?? $order['cod_amount'] ?? 0);
            $collected = (float)$order['total_debt_collected'];
            $remainingDebt = max(0, $totalAmount - $collected);

            // Calculate Days Passed from Delivery Date
            $daysPassed = 0;
            if (!empty($order['delivery_date'])) {
                $deliveryTime = strtotime($order['delivery_date']);
                $now = time();
                $diff = $now - $deliveryTime;
                $daysPassed = floor($diff / (60 * 60 * 24));
            }

            return [
                'id' => $order['id'],
                'customerId' => $order['customer_id'],
                'orderDate' => $order['order_date'],
                'deliveryDate' => $order['delivery_date'],
                'daysPassed' => (int)$daysPassed,
                'totalAmount' => $totalAmount,
                'customerInfo' => [
                    'firstName' => $order['first_name'],
                    'lastName' => $order['last_name'],
                    'phone' => $order['phone']
                ],
                'trackingCount' => (int)$order['tracking_count'],
                'totalDebtCollected' => $collected,
                'remainingDebt' => $remainingDebt
            ];
        }, $orders);

        json_response([
            'ok' => true,
            'orders' => $formattedOrders,
            'pagination' => [
                'page' => $page,
                'pageSize' => $pageSize,
                'total' => $totalOrders,
                'totalPages' => $totalPages
            ]
        ]);
    }

} catch (Exception $e) {
    json_response(['error' => $e->getMessage()], 500);
}
