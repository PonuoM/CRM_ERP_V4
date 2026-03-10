<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST");

require_once __DIR__ . '/../config.php';

try {
  $conn = db_connect();
  $input = json_decode(file_get_contents("php://input"), true);

  $id = $input['id'] ?? null;
  $companyId = $input['company_id'] ?? null;

  if (!$id) {
    http_response_code(400);
    echo json_encode(["success" => false, "error" => "id required"]);
    exit;
  }

  $stmt = $conn->prepare("DELETE FROM marketplace_stores WHERE id = ? AND company_id = ?");
  $stmt->execute([$id, $companyId]);

  echo json_encode(["success" => true, "message" => "Deleted"]);
} catch (Exception $e) {
  http_response_code(500);
  echo json_encode(["success" => false, "error" => $e->getMessage()]);
}
?>
