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
  
  $date = $_GET['date'] ?? null;
  $userId = $_GET['user_id'] ?? null;

  if (!$date) {
    throw new Exception("Missing required parameters");
  }

  $conn = db_connect();
  
  // Query to get existing logs for specific date
  $sql = "SELECT * FROM marketing_product_ads_log WHERE date = ?";
  $params = [$date];
  
  if ($userId) {
    $sql .= " AND user_id = ?";
    $params[] = $userId;
  }
  
  $stmt = $conn->prepare($sql);
  $stmt->execute($params);
  $data = $stmt->fetchAll(PDO::FETCH_ASSOC);
  
  echo json_encode(["success" => true, "data" => $data]);

} catch (Exception $e) {
  http_response_code(500);
  echo json_encode(["success" => false, "error" => $e->getMessage()]);
}
?>
