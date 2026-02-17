<?php
/**
 * delete_call_batch.php
 * DELETE/POST: ลบ batch ทั้งชุด (cascade ลบ logs ด้วย เพราะมี FK ON DELETE CASCADE)
 * Params: batch_id (required), company_id (optional, for ownership check)
 */
error_reporting(E_ALL);
ini_set("display_errors", 1);

require_once __DIR__ . "/../config.php";
cors();

try {
    $pdo = db_connect();
} catch (RuntimeException $e) {
    json_response(["success" => false, "error" => "Database connection failed: " . $e->getMessage()], 500);
}

if ($_SERVER["REQUEST_METHOD"] !== "POST" && $_SERVER["REQUEST_METHOD"] !== "DELETE") {
    json_response(["success" => false, "error" => "Method not allowed"], 405);
}

$data = json_input();
$batchId = isset($data['batch_id']) ? intval($data['batch_id']) : null;
$companyId = isset($data['company_id']) ? intval($data['company_id']) : null;

if (!$batchId) {
    json_response(["success" => false, "error" => "batch_id is required"], 400);
}

try {
    // Verify batch exists (and optionally belongs to company)
    $where = "id = ?";
    $params = [$batchId];
    if ($companyId) {
        $where .= " AND company_id = ?";
        $params[] = $companyId;
    }

    $stmt = $pdo->prepare("SELECT id, file_name, total_rows FROM call_import_batches WHERE $where");
    $stmt->execute($params);
    $batch = $stmt->fetch();

    if (!$batch) {
        json_response(["success" => false, "error" => "Batch not found or access denied"], 404);
    }

    // Delete batch (logs will be cascade-deleted by FK)
    $delStmt = $pdo->prepare("DELETE FROM call_import_batches WHERE id = ?");
    $delStmt->execute([$batchId]);

    json_response([
        "success" => true,
        "message" => "Batch #{$batchId} deleted successfully",
        "deleted" => [
            "batch_id" => $batchId,
            "file_name" => $batch['file_name'],
            "total_rows" => (int) $batch['total_rows'],
        ],
    ]);
} catch (Exception $e) {
    error_log("Delete batch failed: " . $e->getMessage());
    json_response(["success" => false, "error" => "Delete failed: " . $e->getMessage()], 500);
}
?>