<?php
/**
 * Delete Commission Period
 * Deletes a commission period and all related records
 * Only allowed if status is NOT 'Paid'
 * 
 * POST /api/Commission/delete_period.php
 * 
 * Request body:
 * {
 *   "period_id": 123
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
    
    $pdo->beginTransaction();
    
    // Check if period exists and get status
    $checkStmt = $pdo->prepare("
        SELECT id, status FROM commission_periods WHERE id = ?
    ");
    $checkStmt->execute([$period_id]);
    $period = $checkStmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$period) {
        $pdo->rollBack();
        echo json_encode(['ok' => false, 'error' => 'Period not found']);
        exit;
    }
    
    // Cannot delete if status is 'Paid'
    if ($period['status'] === 'Paid') {
        $pdo->rollBack();
        echo json_encode(['ok' => false, 'error' => 'Cannot delete paid period']);
        exit;
    }
    
    // Delete commission_order_lines first (foreign key constraint)
    $pdo->prepare("
        DELETE col FROM commission_order_lines col
        INNER JOIN commission_records cr ON col.record_id = cr.id
        WHERE cr.period_id = ?
    ")->execute([$period_id]);
    
    // Delete commission_records
    $pdo->prepare("DELETE FROM commission_records WHERE period_id = ?")->execute([$period_id]);
    
    // Delete commission_periods
    $pdo->prepare("DELETE FROM commission_periods WHERE id = ?")->execute([$period_id]);
    
    $pdo->commit();
    
    echo json_encode(['ok' => true]);
    
} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}
