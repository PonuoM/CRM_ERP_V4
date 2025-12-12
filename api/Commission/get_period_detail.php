<?php
/**
 * Get detailed commission breakdown for a period
 * GET /api/Commission/get_period_detail.php?period_id=1
 */

require_once __DIR__ . "/../config.php";

header('Content-Type: application/json; charset=utf-8');

try {
    $pdo = db_connect();
    
    $period_id = (int)($_GET['period_id'] ?? 0);
    
    if (!$period_id) {
        echo json_encode(['ok' => false, 'error' => 'Missing period_id']);
        exit;
    }
    
    // Get period info
    $periodStmt = $pdo->prepare("SELECT * FROM commission_periods WHERE id = ?");
    $periodStmt->execute([$period_id]);
    $period = $periodStmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$period) {
        echo json_encode(['ok' => false, 'error' => 'Period not found']);
        exit;
    }
    
    // Get commission records with user info
    $recordsStmt = $pdo->prepare("
        SELECT 
            cr.*,
            u.username,
            u.firstName,
            u.lastName
        FROM commission_records cr
        JOIN users u ON u.id = cr.user_id
        WHERE cr.period_id = ?
        ORDER BY cr.total_sales DESC
    ");
    
    $recordsStmt->execute([$period_id]);
    $records = $recordsStmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Get order lines for each record
    foreach ($records as &$record) {
        $linesStmt = $pdo->prepare("
            SELECT * FROM commission_order_lines 
            WHERE record_id = ?
            ORDER BY order_date DESC
        ");
        $linesStmt->execute([$record['id']]);
        $record['orders'] = $linesStmt->fetchAll(PDO::FETCH_ASSOC);
    }
    
    echo json_encode([
        'ok' => true,
        'data' => [
            'period' => $period,
            'records' => $records
        ]
    ]);
    
} catch (Exception $e) {
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}
