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
    $companyId = isset($_GET['companyId']) ? (int) $_GET['companyId'] : ($user['company_id'] ?? 0);
    $mode = $_GET['mode'] ?? 'list'; // 'list' or 'summary'
    $status = $_GET['status'] ?? 'active'; // 'active' or 'completed'

    // Pagination (only for list mode)
    $page = max(1, (int) ($_GET['page'] ?? 1));
    $pageSize = max(1, (int) ($_GET['pageSize'] ?? 50));
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

    // Dynamic Filter: Use rules for 'shipping' and 'preparing' from order_tab_rules
    // As per user request to be dynamic
    $targetTabs = ['shipping', 'preparing'];
    $placeholders = str_repeat('?,', count($targetTabs) - 1) . '?';

    // Filter rules to only include COD and PayAfter payment methods
    $ruleStmt = $pdo->prepare("SELECT * FROM order_tab_rules 
                               WHERE tab_key IN ($placeholders) 
                               AND is_active = 1 
                               AND payment_method IN ('COD', 'PayAfter')");
    $ruleStmt->execute($targetTabs);
    $rules = $ruleStmt->fetchAll(PDO::FETCH_ASSOC);

    if ($rules) {
        $ruleConditions = [];
        foreach ($rules as $r) {
            $conds = [];

            // payment_method
            if (!empty($r['payment_method'])) {
                $conds[] = "o.payment_method = " . $pdo->quote($r['payment_method']);
            }

            // payment_status
            if (!empty($r['payment_status']) && $r['payment_status'] !== 'ALL') {
                if ($r['payment_status'] === 'NULL') {
                    $conds[] = "o.payment_status IS NULL";
                } else {
                    $statuses = explode(',', $r['payment_status']);
                    if (count($statuses) > 1) {
                        $quoted = array_map(function ($s) use ($pdo) {
                            return $pdo->quote(trim($s));
                        }, $statuses);
                        $conds[] = "o.payment_status IN (" . implode(',', $quoted) . ")";
                    } else {
                        $conds[] = "o.payment_status = " . $pdo->quote(trim($statuses[0]));
                    }
                }
            }

            // order_status
            if (!empty($r['order_status']) && $r['order_status'] !== 'ALL') {
                $statuses = explode(',', $r['order_status']);
                if (count($statuses) > 1) {
                    $quoted = array_map(function ($s) use ($pdo) {
                        return $pdo->quote(trim($s));
                    }, $statuses);
                    $conds[] = "o.order_status IN (" . implode(',', $quoted) . ")";
                } else {
                    $conds[] = "o.order_status = " . $pdo->quote(trim($statuses[0]));
                }
            }

            if (!empty($conds)) {
                $ruleConditions[] = "(" . implode(' AND ', $conds) . ")";
            }
        }

        if (!empty($ruleConditions)) {
            // Apply rules: (Rule1) OR (Rule2) ...
            // Also explicitly include BadDebt orders as per request, regardless of rules
            $whereConditions[] = "(" . implode(' OR ', $ruleConditions) . " OR o.order_status = 'BadDebt')";
        }
    } else {
        // Fallback if no rules found (safe default)
        $whereConditions[] = "(o.order_status IN ('Preparing', 'Picking', 'Shipping') OR o.order_status = 'BadDebt')";
    }

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
        $orConds = [
            "c.first_name LIKE ?",
            "c.last_name LIKE ?",
            "CONCAT(c.first_name, ' ', c.last_name) LIKE ?",
            "o.id LIKE ?",
            "c.phone LIKE ?"
        ];

        $nameLike = '%' . $customerName . '%';
        // Add params for standard checks
        for ($i = 0; $i < 5; $i++)
            $params[] = $nameLike;

        // Specialized Phone Search (strip non-digits)
        $cleanPhone = preg_replace('/\D/', '', $customerName);
        // Only trigger this if we have enough digits to avoid matching everything
        if (strlen($cleanPhone) >= 3) {
            $orConds[] = "REPLACE(REPLACE(REPLACE(REPLACE(c.phone, '-', ''), ' ', ''), '(', ''), ')', '') LIKE ?";
            $params[] = '%' . $cleanPhone . '%';
        }

        $whereConditions[] = "(" . implode(' OR ', $orConds) . ")";
    }

    if ($customerPhone) {
        $phoneDigits = preg_replace('/\D/', '', $customerPhone);
        $whereConditions[] = "REPLACE(REPLACE(REPLACE(c.phone, '-', ''), ' ', ''), '(', '') LIKE ?";
        $params[] = '%' . $phoneDigits . '%';
    }

    if ($orderId) {
        $orConds = ["o.id LIKE ?"];
        $orderIdLike = '%' . $orderId . '%';
        $params[] = $orderIdLike;

        // Also check phone for short numeric inputs (which frontend sends as orderId)
        // Standard phone check
        $orConds[] = "c.phone LIKE ?";
        $params[] = $orderIdLike;

        // Robust phone check
        $cleanPhone = preg_replace('/\D/', '', $orderId);
        if (strlen($cleanPhone) >= 3) {
            $orConds[] = "REPLACE(REPLACE(REPLACE(REPLACE(c.phone, '-', ''), ' ', ''), '(', ''), ')', '') LIKE ?";
            $params[] = '%' . $cleanPhone . '%';
        }

        $whereConditions[] = "(" . implode(' OR ', $orConds) . ")";
    }

    // New Filters
    $minDaysOverdue = isset($_GET['minDaysOverdue']) ? (int) $_GET['minDaysOverdue'] : null;
    if ($minDaysOverdue) {
        // o.delivery_date must be older than X days ago
        // delivery_date <= DATE_SUB(NOW(), INTERVAL X DAY)
        $whereConditions[] = "o.delivery_date <= DATE_SUB(NOW(), INTERVAL ? DAY)";
        $params[] = $minDaysOverdue;
    }

    $startDate = $_GET['startDate'] ?? null;
    $endDate = $_GET['endDate'] ?? null;
    if ($startDate) {
        $val = strpos($startDate, 'T') !== false ? $startDate : $startDate . ' 00:00:00';
        $whereConditions[] = "o.delivery_date >= ?";
        $params[] = $val;
    }
    if ($endDate) {
        $val = strpos($endDate, 'T') !== false ? $endDate : $endDate . ' 23:59:59';
        $whereConditions[] = "o.delivery_date <= ?";
        $params[] = $val;
    }

    $trackingStatus = $_GET['trackingStatus'] ?? null; // 'never', 'tracked'
    if ($trackingStatus === 'never') {
        $whereConditions[] = "(SELECT COUNT(*) FROM debt_collection dc WHERE dc.order_id = o.id) = 0";
    } elseif ($trackingStatus === 'tracked') {
        $whereConditions[] = "(SELECT COUNT(*) FROM debt_collection dc WHERE dc.order_id = o.id) > 0";
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
            'orderCount' => (int) ($result['order_count'] ?? 0),
            'totalDebt' => (float) ($result['total_remaining_debt'] ?? 0)
        ]);

    } else {
        // List Mode

        // Count Total for Pagination
        $countSql = "SELECT COUNT(DISTINCT o.id) FROM orders o 
                     LEFT JOIN customers c ON o.customer_id = c.customer_id 
                     $whereClause";
        $countStmt = $pdo->prepare($countSql);
        $countStmt->execute($params);
        $totalOrders = (int) $countStmt->fetchColumn();
        $totalPages = ceil($totalOrders / $pageSize);

        // Fetch Orders
        $sql = "SELECT 
                    o.id, o.customer_id, o.order_date, o.delivery_date, o.total_amount, o.amount_paid, o.cod_amount,
                    o.order_status, o.payment_status,
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
        $formattedOrders = array_map(function ($order) {
            $totalAmount = (float) $order['total_amount'];
            $paidAmount = (float) ($order['amount_paid'] ?? $order['cod_amount'] ?? 0);
            $collected = (float) $order['total_debt_collected'];
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
                'orderStatus' => $order['order_status'],
                'paymentStatus' => $order['payment_status'],
                'orderDate' => $order['order_date'],
                'deliveryDate' => $order['delivery_date'],
                'daysPassed' => (int) $daysPassed,
                'totalAmount' => $totalAmount,
                'customerInfo' => [
                    'firstName' => $order['first_name'],
                    'lastName' => $order['last_name'],
                    'phone' => $order['phone']
                ],
                'trackingCount' => (int) $order['tracking_count'],
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
