<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST");

require_once __DIR__ . '/../config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["success" => false, "error" => "Method not allowed"]);
    exit;
}

try {
    $conn = db_connect();
    $data = json_decode(file_get_contents("php://input"), true);

    $batchId = $data['batch_id'] ?? null;
    $companyId = $data['company_id'] ?? null;

    if (!$batchId || !$companyId) {
        echo json_encode(["success" => false, "error" => "Missing batch_id or company_id"]);
        exit;
    }

    // Verify batch belongs to company
    $stmt = $conn->prepare("SELECT id FROM marketplace_import_batches WHERE id = ? AND company_id = ?");
    $stmt->execute([$batchId, $companyId]);
    if (!$stmt->fetch()) {
        echo json_encode(["success" => false, "error" => "Batch not found"]);
        exit;
    }

    // Delete orders first (CASCADE should handle this, but be explicit)
    $stmt = $conn->prepare("DELETE FROM marketplace_sales_orders WHERE batch_id = ?");
    $stmt->execute([$batchId]);
    $deletedRows = $stmt->rowCount();

    // Delete batch
    $stmt = $conn->prepare("DELETE FROM marketplace_import_batches WHERE id = ?");
    $stmt->execute([$batchId]);

    echo json_encode([
        "success" => true,
        "deleted_rows" => $deletedRows,
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["success" => false, "error" => $e->getMessage()]);
}
?>
