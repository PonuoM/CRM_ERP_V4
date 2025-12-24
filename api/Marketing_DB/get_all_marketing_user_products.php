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
  
  $conn = db_connect();
  
  $sql = "SELECT mup.user_id, mup.product_id, 
                 u.first_name, u.last_name, u.username,
                 p.name as product_name, p.sku
          FROM marketing_user_product mup
          JOIN users u ON mup.user_id = u.id
          JOIN products p ON mup.product_id = p.id
          ORDER BY mup.product_id, u.first_name";
          
  $stmt = $conn->prepare($sql);
  $stmt->execute();
  $data = $stmt->fetchAll(PDO::FETCH_ASSOC);
  
  echo json_encode(["success" => true, "data" => $data]);
  
} catch (Exception $e) {
  http_response_code(500);
  echo json_encode(["success" => false, "error" => $e->getMessage()]);
}
?>
