<?php
/**
 * Mark a commission period as paid
 * POST /api/Commission/mark_paid.php
 * 
 * Request body:
 * {
 *   "period_id": 1
 * }
 */

require_once __DIR__ . "/../config.php";

header('Content-Type: application/json; charset=utf-8');

try {
    $pdo = db_connect();
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    $period_id = (int)($input['period_id'] ?? 0);
    
    if (!$period_id) {
        echo json_encode(['ok' => false, 'error' => 'Missing period_id']);
        exit;
    }
    
    $stmt = $pdo->prepare("
        UPDATE commission_periods 
        SET status = 'Paid', paid_at = NOW()
        WHERE id = ? AND status = 'Approved'
    ");
    
    $stmt->execute([$period_id]);
    
    if ($stmt->rowCount() > 0) {
        echo json_encode(['ok' => true, 'message' => 'Period marked as paid']);
    } else {
        echo json_encode(['ok' => false, 'error' => 'Period not found or not approved']);
    }
    
} catch (Exception $e) {
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}
