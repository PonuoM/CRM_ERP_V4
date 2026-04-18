<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

require_once __DIR__ . '/../config.php';
$pdo = db_connect();

try {
    $input = json_decode(file_get_contents('php://input'), true);
    $companyId = $input['company_id'] ?? 1;
    $action = $input['action'] ?? 'save'; // save, delete

    $pdo->beginTransaction();

    if ($action === 'delete') {
        $id = $input['id'] ?? null;
        if (!$id) throw new Exception("Mapping ID is required for deletion");
        $pdo->prepare("DELETE FROM inv2_warehouse_mappings WHERE id = ? AND company_id = ?")->execute([$id, $companyId]);
    } else {
        $dispatchName = $input['dispatch_warehouse_name'] ?? null;
        $mainWhId = $input['main_warehouse_id'] ?? null;
        if (!$dispatchName || !$mainWhId) throw new Exception("dispatch_warehouse_name and main_warehouse_id are required required");
        
        // Upsert
        $sql = "INSERT INTO inv2_warehouse_mappings (company_id, dispatch_warehouse_name, main_warehouse_id) 
                VALUES (?, ?, ?) 
                ON DUPLICATE KEY UPDATE main_warehouse_id = VALUES(main_warehouse_id)";
        $pdo->prepare($sql)->execute([$companyId, $dispatchName, $mainWhId]);
    }

    $pdo->commit();
    echo json_encode(['success' => true]);
} catch (Exception $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
