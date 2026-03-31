<?php
/**
 * Update Batch Period — อัปเดต for_month และ for_year ของ batch
 * POST { batch_id, for_month, for_year }
 */
require_once __DIR__ . "/../config.php";

header('Content-Type: application/json; charset=utf-8');

try {
    $pdo = db_connect();
    $input = json_decode(file_get_contents('php://input'), true);

    $batch_id = (int)($input['batch_id'] ?? 0);
    $for_month = isset($input['for_month']) && $input['for_month'] !== '' ? (int)$input['for_month'] : null;
    $for_year = isset($input['for_year']) && $input['for_year'] !== '' ? (int)$input['for_year'] : null;

    if (!$batch_id) {
        echo json_encode(['ok' => false, 'error' => 'Missing batch_id']);
        exit;
    }

    $stmt = $pdo->prepare("
        UPDATE commission_stamp_batches
        SET for_month = ?, for_year = ?
        WHERE id = ?
    ");
    $stmt->execute([$for_month, $for_year, $batch_id]);

    echo json_encode(['ok' => true, 'message' => 'Batch period updated']);
} catch (Exception $e) {
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}
