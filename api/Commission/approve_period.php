<?php
/**
 * Approve a commission period
 * POST /api/Commission/approve_period.php
 * 
 * Request body:
 * {
 *   "period_id": 1,
 *   "approved_by": 1650
 * }
 */

require_once __DIR__ . "/../config.php";

header('Content-Type: application/json; charset=utf-8');

try {
    $pdo = db_connect();
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    $period_id = (int)($input['period_id'] ?? 0);
    $approved_by = (int)($input['approved_by'] ?? 0);
    
    if (!$period_id || !$approved_by) {
        echo json_encode(['ok' => false, 'error' => 'Missing required parameters']);
        exit;
    }
    
    $stmt = $pdo->prepare("
        UPDATE commission_periods 
        SET status = 'Approved', approved_at = NOW(), approved_by = ?
        WHERE id = ? AND status = 'Calculated'
    ");
    
    $stmt->execute([$approved_by, $period_id]);
    
    if ($stmt->rowCount() > 0) {
        echo json_encode(['ok' => true, 'message' => 'Period approved']);
    } else {
        echo json_encode(['ok' => false, 'error' => 'Period not found or already approved']);
    }
    
} catch (Exception $e) {
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}
