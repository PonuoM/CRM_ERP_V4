<?php
ini_set('display_errors', 1);
error_reporting(E_ALL);

require_once __DIR__ . '/../config.php';

cors();

try {
    $pdo = db_connect();
    
    // Auth check
    validate_auth($pdo);

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

    json_response([
        'ok' => true,
        'company_id' => $companyId,
        'stats' => [
            'totalCustomers' => (int)$totalCustomers,
            'grades' => $grades
        ]
    ]);

} catch (Throwable $e) {
    json_response(['ok' => false, 'error' => $e->getMessage()], 500);
}
