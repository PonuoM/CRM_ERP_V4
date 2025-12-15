<?php
header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
  http_response_code(204);
  exit();
}

require_once dirname(__DIR__) . "/config.php";

register_shutdown_function(function() {
    $error = error_get_last();
    if ($error !== null && $error['type'] === E_ERROR) {
        file_put_contents(__DIR__ . "/debug_cancel.txt", "FATAL ERROR: " . print_r($error, true) . "\n", FILE_APPEND);
    }
});

file_put_contents(__DIR__ . "/debug_cancel.txt", "Start Cancel " . date("Y-m-d H:i:s") . "\n", FILE_APPEND);

$input = json_decode(file_get_contents("php://input"), true);
$id = $input["id"] ?? null; // reconcile_id
$companyId = $input["company_id"] ?? null;

if (!$id || !$companyId) {
    http_response_code(400);
    echo json_encode(["ok" => false, "error" => "Missing id or company_id"]);
    exit();
}

try {
    $pdo = db_connect();
    
    // Check if it exists and belongs to company
    $stmt = $pdo->prepare("
        SELECT srl.id 
        FROM statement_reconcile_logs srl
        INNER JOIN statement_reconcile_batches srb ON srb.id = srl.batch_id
        WHERE srl.id = :id AND srb.company_id = :companyId
    ");
    $stmt->execute([':id' => $id, ':companyId' => $companyId]);
    if (!$stmt->fetch()) {
        throw new Exception("Record not found or access denied");
    }

    // Delete the reconcile log (Unpause/Cancel reconcile)
    $delStmt = $pdo->prepare("DELETE FROM statement_reconcile_logs WHERE id = :id");
    $delStmt->execute([':id' => $id]);

    echo json_encode(["ok" => true]);

} catch (Exception $e) {
    http_response_code(500);
    file_put_contents(__DIR__ . "/debug_cancel.txt", "Exception: " . $e->getMessage() . "\n", FILE_APPEND);
    echo json_encode(["ok" => false, "error" => $e->getMessage()]);
}
?>
