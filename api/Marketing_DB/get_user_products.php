<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
  exit(0);
}

try {
  require_once "../config.php";
  
  $userId = $_GET['user_id'] ?? null;

  if (!$userId) {
    throw new Exception("Missing user_id parameter");
  }

  $conn = db_connect();
  
  $sql = "SELECT p.* 
          FROM marketing_user_product mup
          JOIN products p ON mup.product_id = p.id
          WHERE mup.user_id = ?";
          
  $stmt = $conn->prepare($sql);
  $stmt->execute([$userId]);
  $data = $stmt->fetchAll(PDO::FETCH_ASSOC);
  
  echo json_encode(["success" => true, "data" => $data]);
  
} catch (Exception $e) {
  http_response_code(500);
  echo json_encode(["success" => false, "error" => $e->getMessage()]);
}
?>
