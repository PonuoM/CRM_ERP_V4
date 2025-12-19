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

    // 1. Get Total Customers
    $stmtTotal = $pdo->prepare("SELECT COUNT(*) FROM customers WHERE company_id = ?");
    $stmtTotal->execute([$companyId]);
    $totalCustomers = $stmtTotal->fetchColumn();

    // 2. Get Grade Distribution
    $stmtGrades = $pdo->prepare("SELECT grade, COUNT(*) as count FROM customers WHERE company_id = ? GROUP BY grade");
    $stmtGrades->execute([$companyId]);
    $gradesData = $stmtGrades->fetchAll();

    $grades = [];
    foreach ($gradesData as $row) {
        // Handle null grades as 'Unassigned' or similar if needed, or just keep null/empty
        $key = $row['grade'] ?: 'Unknown'; 
        $grades[$key] = (int)$row['count'];
    }

    // 3. Get Basket Statistics
    // ตะกร้ารอแจก (waiting basket) - customers with assigned_to = NULL and not blocked and not in waiting basket
    $stmtWaitingDistribute = $pdo->prepare("
        SELECT COUNT(*) 
        FROM customers 
        WHERE company_id = ? 
        AND assigned_to IS NULL 
        AND (is_blocked IS NULL OR is_blocked = 0)
        AND (is_in_waiting_basket IS NULL OR is_in_waiting_basket = 0)
    ");
    $stmtWaitingDistribute->execute([$companyId]);
    $waitingDistributeCount = (int)$stmtWaitingDistribute->fetchColumn();

    // ตะกร้าพักรายชื่อ (waiting basket) - customers in waiting basket
    $stmtWaitingBasket = $pdo->prepare("
        SELECT COUNT(*) 
        FROM customers 
        WHERE company_id = ? 
        AND is_in_waiting_basket = 1
        AND (is_blocked IS NULL OR is_blocked = 0)
    ");
    $stmtWaitingBasket->execute([$companyId]);
    $waitingBasketCount = (int)$stmtWaitingBasket->fetchColumn();

    // ตะกร้าบล็อค (blocked basket) - blocked customers
    $stmtBlocked = $pdo->prepare("
        SELECT COUNT(*) 
        FROM customers 
        WHERE company_id = ? 
        AND is_blocked = 1
    ");
    $stmtBlocked->execute([$companyId]);
    $blockedCount = (int)$stmtBlocked->fetchColumn();

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
            ]
        ]
    ]);

} catch (Throwable $e) {
    json_response(['ok' => false, 'error' => $e->getMessage()], 500);
}
