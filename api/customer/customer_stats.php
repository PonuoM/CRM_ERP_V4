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

    require_once __DIR__ . '/distribution_helper.php';

    // 3. Get Basket Statistics
    
    // 3.1 ตะกร้ารอแจกทั่วไป (General Pool)
    $generalPoolParts = DistributionHelper::getGeneralPoolParts($companyId);
    $stmtWaitingDistribute = $pdo->prepare("SELECT COUNT(*) FROM customers c {$generalPoolParts['join']} WHERE {$generalPoolParts['where']}");
    $stmtWaitingDistribute->execute($generalPoolParts['params']);
    $waitingDistributeCount = (int)$stmtWaitingDistribute->fetchColumn();

    // 3.2 ตะกร้าพักรายชื่อ (Waiting Basket) - Total currently in basket
    // This is just a raw count of people in basket, regardless of time
    $stmtWaitingBasket = $pdo->prepare("
        SELECT COUNT(*) 
        FROM customers c
        WHERE c.company_id = ? 
        AND c.is_in_waiting_basket = 1
        AND (c.is_blocked IS NULL OR c.is_blocked = 0)
    ");
    $stmtWaitingBasket->execute([$companyId]);
    $waitingBasketCount = (int)$stmtWaitingBasket->fetchColumn();

    // 3.3 ตะกร้าบล็อค (Blocked)
    $stmtBlocked = $pdo->prepare("
        SELECT COUNT(*) 
        FROM customers c
        WHERE c.company_id = ? 
        AND c.is_blocked = 1
    ");
    $stmtBlocked->execute([$companyId]);
    $blockedCount = (int)$stmtBlocked->fetchColumn();

    // 4. Get New Sale Count
    $freshDays = isset($_GET['freshDays']) ? (int)$_GET['freshDays'] : 7;
    $newSaleParts = DistributionHelper::getNewSaleParts($companyId, $freshDays);
    // Note: new_sale query has GROUP BY, so we need COUNT(DISTINCT ...) or wrap in subquery. 
    // Helper has groupBy 'GROUP BY c.customer_id'.
    // Better to use COUNT(DISTINCT c.customer_id) and ignore Group By for the count query if possible, 
    // OR use the helper's full query structure.
    // The helper constructs for SELECT *, so it includes GROUP BY.
    // Use simple COUNT(DISTINCT c.customer_id) is safer here as per original logic.
    // BUT the helper returns specific joins.
    // Let's use the parts.
    // Original: SELECT COUNT(DISTINCT c.customer_id) ...
    $sqlNewSale = "SELECT COUNT(DISTINCT c.customer_id) FROM customers c {$newSaleParts['join']} WHERE {$newSaleParts['where']}";
    $stmtNewSale = $pdo->prepare($sqlNewSale);
    $stmtNewSale->execute($newSaleParts['params']);
    $newSaleCount = (int)$stmtNewSale->fetchColumn();

    // 5. Get Waiting Return Count (Ready to return from basket)
    $waitingReturnParts = DistributionHelper::getWaitingReturnParts($companyId);
    $stmtWaitingReturn = $pdo->prepare("SELECT COUNT(*) FROM customers c {$waitingReturnParts['join']} WHERE {$waitingReturnParts['where']}");
    $stmtWaitingReturn->execute($waitingReturnParts['params']);
    $waitingReturnCount = (int)$stmtWaitingReturn->fetchColumn();

    // 6. Get Stock Count
    $stockParts = DistributionHelper::getStockParts($companyId, $freshDays);
    $stmtStock = $pdo->prepare("SELECT COUNT(*) FROM customers c {$stockParts['join']} WHERE {$stockParts['where']}");
    $stmtStock->execute($stockParts['params']);
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
