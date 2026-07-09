<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once '../config.php';
$pdo = db_connect();

try {
    $input = json_decode(file_get_contents('php://input'), true);
    $planId = (int)($input['id'] ?? 0);
    $force = !empty($input['force']); // emergency override, intended for SuperAdmin only (enforced client-side)
    if (!$planId) {
        throw new Exception('Missing plan id');
    }

    $pdo->beginTransaction();

    if (!$force) {
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM stock_arrival_plan_expectations e
                                JOIN stock_arrival_plan_items i ON e.item_id = i.id
                                WHERE i.plan_id = ? AND e.status != 'expected'");
        $stmt->execute([$planId]);
        if ((int)$stmt->fetchColumn() > 0) {
            throw new Exception('Cannot delete a plan that already has confirmed items');
        }
    }

    // Cascades to items then expectations via FK
    $pdo->prepare("DELETE FROM stock_arrival_plans WHERE id = ?")->execute([$planId]);

    $pdo->commit();
    echo json_encode(['success' => true]);

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
