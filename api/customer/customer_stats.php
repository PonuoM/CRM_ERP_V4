<?php
ini_set('display_errors', 1);
error_reporting(E_ALL);

require_once __DIR__ . '/../config.php';

cors();

try {
    $pdo = db_connect();
    
    // Auth check
    // validate_auth($pdo);

    $companyId = isset($_GET['company_id']) ? (int)$_GET['company_id'] : null;
    
    file_put_contents(__DIR__ . '/stats_debug.log', date('Y-m-d H:i:s') . " Request for company: " . json_encode($companyId) . "\n", FILE_APPEND);

    if (!$companyId) {
        json_response(['error' => 'Missing company_id'], 400);
    }

    $assignedTo = isset($_GET['assigned_to']) ? (int)$_GET['assigned_to'] : null;

    // 1. Get Total Customers
    $sqlTotal = "SELECT COUNT(*) FROM customers WHERE company_id = ?";
    $paramsTotal = [$companyId];
    if ($assignedTo) {
        $sqlTotal .= " AND assigned_to = ?";
        $paramsTotal[] = $assignedTo;
    }
    $stmtTotal = $pdo->prepare($sqlTotal);
    $stmtTotal->execute($paramsTotal);
    $totalCustomers = $stmtTotal->fetchColumn();

    // 2. Get Grade Distribution
    $sqlGrades = "SELECT grade, COUNT(*) as count FROM customers WHERE company_id = ? ";
    $paramsGrades = [$companyId];
    if ($assignedTo) {
        $sqlGrades .= " AND assigned_to = ? ";
        $paramsGrades[] = $assignedTo;
    }
    $sqlGrades .= "GROUP BY grade";
    
    $stmtGrades = $pdo->prepare($sqlGrades);
    $stmtGrades->execute($paramsGrades);
    $gradesData = $stmtGrades->fetchAll();

    $grades = [];
    foreach ($gradesData as $row) {
        // Handle null grades as 'Unassigned' or similar if needed, or just keep null/empty
        $key = $row['grade'] ?: 'Unknown'; 
        $grades[$key] = (int)$row['count'];
    }

    // 3. Get Basket Statistics
    
    // 3.1 ตะกร้ารอแจกทั่วไป (General Pool)
    // Logic matches 'all' mode in bulk_distribute.php
    $stmtWaitingDistribute = $pdo->prepare("
        SELECT COUNT(*) 
        FROM customers c
        WHERE c.company_id = ? 
        AND c.assigned_to IS NULL 
        AND (c.is_blocked IS NULL OR c.is_blocked = 0)
        AND (c.is_in_waiting_basket IS NULL OR c.is_in_waiting_basket = 0)
        AND (c.last_follow_up_date IS NULL OR DATEDIFF(NOW(), c.last_follow_up_date) > 7)
    ");
    $stmtWaitingDistribute->execute([$companyId]);
    $waitingDistributeCount = (int)$stmtWaitingDistribute->fetchColumn();

    // 3.2 ตะกร้าพักรายชื่อ (Waiting Basket) - Total currently in basket
    // This is just a raw count of people in basket, regardless of time
    $stmtWaitingBasket = $pdo->prepare("
        SELECT COUNT(*) 
        FROM customers 
        WHERE company_id = ? 
        AND is_in_waiting_basket = 1
        AND (is_blocked IS NULL OR is_blocked = 0)
    ");
    $stmtWaitingBasket->execute([$companyId]);
    $waitingBasketCount = (int)$stmtWaitingBasket->fetchColumn();

    // 3.3 ตะกร้าบล็อค (Blocked)
    $stmtBlocked = $pdo->prepare("
        SELECT COUNT(*) 
        FROM customers 
        WHERE company_id = ? 
        AND is_blocked = 1
    ");
    $stmtBlocked->execute([$companyId]);
    $blockedCount = (int)$stmtBlocked->fetchColumn();

    // 4. Get New Sale Count
    // Logic matches 'new_sale' mode in bulk_distribute.php
    $freshDays = isset($_GET['freshDays']) ? (int)$_GET['freshDays'] : 7;
    $stmtNewSale = $pdo->prepare("
        SELECT COUNT(DISTINCT c.customer_id)
        FROM customers c
        JOIN orders o ON o.customer_id = c.customer_id
        LEFT JOIN users u ON u.id = o.creator_id
        WHERE c.company_id = ?
          AND COALESCE(c.is_blocked,0) = 0
          AND c.assigned_to IS NULL
          AND (u.role = 'Admin Page' OR o.sales_channel IS NOT NULL OR o.sales_channel_page_id IS NOT NULL)
          AND (o.order_status IS NULL OR o.order_status <> 'Cancelled')
          AND TIMESTAMPDIFF(DAY, o.order_date, NOW()) <= ?
    ");
    $stmtNewSale->execute([$companyId, max(0, $freshDays)]);
    $newSaleCount = (int)$stmtNewSale->fetchColumn();

    // 5. Get Waiting Return Count (Ready to return from basket)
    // Logic matches 'waiting_return' mode in bulk_distribute.php
    $stmtWaitingReturn = $pdo->prepare("
        SELECT COUNT(*)
        FROM customers c
        WHERE c.company_id = ?
        AND COALESCE(c.is_blocked,0) = 0
        AND c.is_in_waiting_basket = 1
        AND c.waiting_basket_start_date IS NOT NULL
        AND TIMESTAMPDIFF(DAY, c.waiting_basket_start_date, NOW()) >= 30
        AND c.assigned_to IS NULL
        AND (c.last_follow_up_date IS NULL OR DATEDIFF(NOW(), c.last_follow_up_date) > 7)
    ");
    $stmtWaitingReturn->execute([$companyId]);
    $waitingReturnCount = (int)$stmtWaitingReturn->fetchColumn();

    // 6. Get Stock Count
    // Logic matches 'stock' mode in bulk_distribute.php
    $stmtStock = $pdo->prepare("
        SELECT COUNT(*)
        FROM customers c
        WHERE c.company_id = ?
        AND c.assigned_to IS NULL
        AND COALESCE(c.is_blocked,0) = 0
        AND (c.is_in_waiting_basket = 0 OR (c.is_in_waiting_basket = 1 AND DATEDIFF(NOW(), c.waiting_basket_start_date) >= 30))
        AND NOT EXISTS (
            SELECT 1 FROM orders o
            LEFT JOIN users u ON u.id = o.creator_id
            WHERE o.customer_id = c.customer_id
              AND (u.role = 'Admin Page' OR o.sales_channel IS NOT NULL OR o.sales_channel_page_id IS NOT NULL)
              AND (o.order_status IS NULL OR o.order_status <> 'Cancelled')
              AND TIMESTAMPDIFF(DAY, o.order_date, NOW()) <= 7
        )
    ");
    $stmtStock->execute([$companyId]);
    $stockCount = (int)$stmtStock->fetchColumn();

    json_response([
        'ok' => true,
        'company_id' => $companyId,
        'stats' => [
            'totalCustomers' => (int)$totalCustomers,
            'grades' => $grades,
            'baskets' => [
                'waitingDistribute' => $waitingDistributeCount,
                'waitingBasket' => $waitingBasketCount,
                'blocked' => $blockedCount,
                // Additional counts for Distribution Page optimization
                'newSale' => $newSaleCount,
                'waitingReturn' => $waitingReturnCount,
                'stock' => $stockCount,
            ]
        ]
    ]);

} catch (Throwable $e) {
    json_response(['ok' => false, 'error' => $e->getMessage()], 500);
}
