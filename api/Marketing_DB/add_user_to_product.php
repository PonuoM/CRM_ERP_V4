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
  
  if (!isset($data['user_id']) || !isset($data['product_id'])) {
    throw new Exception("Missing required parameters: user_id or product_id");
  }

  $conn = db_connect();
  
  $sql = "INSERT IGNORE INTO marketing_user_product (user_id, product_id) VALUES (?, ?)";
  $stmt = $conn->prepare($sql);
  $stmt->execute([$data['user_id'], $data['product_id']]);
  
  echo json_encode(["success" => true, "message" => "User assigned to product successfully"]);
  
} catch (Exception $e) {
  http_response_code(500);
  echo json_encode(["success" => false, "error" => $e->getMessage()]);
}
?>
