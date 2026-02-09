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
  
  $sql = "SELECT mua.user_id, mua.ads_group, 
                 u.first_name, u.last_name, u.username
          FROM marketing_user_ads_group mua
          JOIN users u ON mua.user_id = u.id
          ORDER BY mua.ads_group, u.first_name";
          
  $stmt = $conn->prepare($sql);
  $stmt->execute();
  $data = $stmt->fetchAll(PDO::FETCH_ASSOC);
  
  echo json_encode(["success" => true, "data" => $data]);
  
} catch (Exception $e) {
  http_response_code(500);
  echo json_encode(["success" => false, "error" => $e->getMessage()]);
}
?>
