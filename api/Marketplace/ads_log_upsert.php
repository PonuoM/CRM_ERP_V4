<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST");

require_once __DIR__ . '/../config.php';

try {
  $conn = db_connect();
  $input = json_decode(file_get_contents("php://input"), true);

  $storeId = $input['store_id'] ?? null;
  $date = $input['date'] ?? null;
  $adsCost = $input['ads_cost'] ?? 0;
  $impressions = $input['impressions'] ?? 0;
  $clicks = $input['clicks'] ?? 0;
  $userId = $input['user_id'] ?? null;

  if (!$storeId || !$date || !$userId) {
    http_response_code(400);
    echo json_encode(["success" => false, "error" => "store_id, date, user_id required"]);
    exit;
  }

  $stmt = $conn->prepare("
    INSERT INTO marketplace_ads_log (store_id, date, ads_cost, impressions, clicks, user_id)
    VALUES (?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      ads_cost = VALUES(ads_cost),
      impressions = VALUES(impressions),
      clicks = VALUES(clicks),
      user_id = VALUES(user_id)
  ");
  $stmt->execute([$storeId, $date, $adsCost, $impressions, $clicks, $userId]);

  echo json_encode(["success" => true, "message" => "Saved"]);
} catch (Exception $e) {
  http_response_code(500);
  echo json_encode(["success" => false, "error" => $e->getMessage()]);
}
?>
