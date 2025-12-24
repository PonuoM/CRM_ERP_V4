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
  
  // Get input
  $input = json_input();
  
  if (empty($input['logs']) || !is_array($input['logs'])) {
    throw new Exception("Invalid data format");
  }

  $conn = db_connect();
  
  // Start transaction
  $conn->beginTransaction();
  
  $stmt = $conn->prepare("
    INSERT INTO marketing_product_ads_log (user_id, product_id, date, ads_cost, impressions, reach, clicks) 
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE 
    ads_cost = VALUES(ads_cost),
    impressions = VALUES(impressions),
    reach = VALUES(reach),
    clicks = VALUES(clicks)
  ");

  foreach ($input['logs'] as $log) {
    if (empty($log['product_id']) || empty($log['date'])) {
      continue;
    }

    $params = [
      $log['user_id'] ?? $input['user_id'], // Fallback if not in log item
      $log['product_id'],
      $log['date'],
      !empty($log['ads_cost']) ? $log['ads_cost'] : null,
      !empty($log['impressions']) ? $log['impressions'] : null,
      !empty($log['reach']) ? $log['reach'] : null,
      !empty($log['clicks']) ? $log['clicks'] : null
    ];
    
    $stmt->execute($params);
  }
  
  $conn->commit();
  
  echo json_encode(["success" => true]);

} catch (Exception $e) {
  if (isset($conn) && $conn->inTransaction()) {
    $conn->rollBack();
  }
  http_response_code(500);
  echo json_encode(["success" => false, "error" => $e->getMessage()]);
}
?>
