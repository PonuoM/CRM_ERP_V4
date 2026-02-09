<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
  exit(0);
}

try {
  require_once "../config.php";
  
  $data = json_decode(file_get_contents("php://input"), true);
  
  if (!isset($data['user_id']) || !isset($data['ads_group'])) {
    throw new Exception("Missing required parameters: user_id or ads_group");
  }

  $conn = db_connect();
  
  $sql = "DELETE FROM marketing_user_ads_group WHERE user_id = ? AND ads_group = ?";
  $stmt = $conn->prepare($sql);
  $stmt->execute([$data['user_id'], $data['ads_group']]);
  
  echo json_encode(["success" => true, "message" => "User removed from ads group successfully"]);
  
} catch (Exception $e) {
  http_response_code(500);
  echo json_encode(["success" => false, "error" => $e->getMessage()]);
}
?>
