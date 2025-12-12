<?php
/**
 * Get list of commission periods
 * GET /api/Commission/get_periods.php?company_id=1
 */

require_once __DIR__ . "/../config.php";

header('Content-Type: application/json; charset=utf-8');

try {
    $pdo = db_connect();
    
    $company_id = (int)($_GET['company_id'] ?? 0);
    
    if (!$company_id) {
        echo json_encode(['ok' => false, 'error' => 'Missing company_id']);
        exit;
    }
    
    $stmt = $pdo->prepare("
        SELECT 
            cp.*,
            COUNT(cr.id) as salesperson_count,
            CONCAT(period_year, '-', LPAD(period_month, 2, '0')) as period_display,
            CONCAT(order_year, '-', LPAD(order_month, 2, '0')) as order_period_display
        FROM commission_periods cp
        LEFT JOIN commission_records cr ON cr.period_id = cp.id
        WHERE cp.company_id = ?
        GROUP BY cp.id
        ORDER BY cp.period_year DESC, cp.period_month DESC
    ");
    
    $stmt->execute([$company_id]);
    $periods = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode(['ok' => true, 'data' => $periods]);
    
} catch (Exception $e) {
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}
