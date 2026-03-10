<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST");

require_once __DIR__ . '/../config.php';

try {
  $conn = db_connect();
  $input = json_decode(file_get_contents("php://input"), true);

  $id = $input['id'] ?? null;
  $name = $input['name'] ?? null;
  $platform = $input['platform'] ?? null;
  $url = $input['url'] ?? null;
  $managerUserId = $input['manager_user_id'] ?? null;
  $companyId = $input['company_id'] ?? null;
  $active = isset($input['active']) ? (int)$input['active'] : 1;

  if (!$name || !$platform || !$companyId) {
    http_response_code(400);
    echo json_encode(["success" => false, "error" => "name, platform, company_id required"]);
    exit;
  }

  if ($id) {
    // Update
    $stmt = $conn->prepare("
      UPDATE marketplace_stores 
      SET name = ?, platform = ?, url = ?, manager_user_id = ?, active = ?
      WHERE id = ? AND company_id = ?
    ");
    $stmt->execute([$name, $platform, $url, $managerUserId, $active, $id, $companyId]);
    echo json_encode(["success" => true, "message" => "Updated", "id" => $id]);
  } else {
    // Insert
    $stmt = $conn->prepare("
      INSERT INTO marketplace_stores (name, platform, url, manager_user_id, company_id, active)
      VALUES (?, ?, ?, ?, ?, ?)
    ");
    $stmt->execute([$name, $platform, $url, $managerUserId, $companyId, $active]);
    echo json_encode(["success" => true, "message" => "Created", "id" => $conn->lastInsertId()]);
  }
} catch (Exception $e) {
  http_response_code(500);
  echo json_encode(["success" => false, "error" => $e->getMessage()]);
}
?>
