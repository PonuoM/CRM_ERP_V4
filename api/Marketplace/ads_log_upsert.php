<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST");

require_once __DIR__ . '/../config.php';

try {
  $conn = db_connect();
  $input = json_decode(file_get_contents("php://input"), true);

  // Support batch records (V2 style)
  if (isset($input['records']) && is_array($input['records'])) {
    $stmt = $conn->prepare("
      INSERT INTO marketplace_ads_log (store_id, date, ads_cost, impressions, clicks, user_id)
      VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        ads_cost = VALUES(ads_cost),
        impressions = VALUES(impressions),
        clicks = VALUES(clicks),
        user_id = VALUES(user_id)
    ");
    $inserted = 0; $updated = 0; $skipped = 0;
    foreach ($input['records'] as $rec) {
      $storeId = $rec['store_id'] ?? null;
      $date = $rec['date'] ?? null;
      $userId = $rec['user_id'] ?? null;
      if (!$storeId || !$date || !$userId) { $skipped++; continue; }
      $stmt->execute([
        $storeId, $date,
        $rec['ads_cost'] ?? 0,
        $rec['impressions'] ?? 0,
        $rec['clicks'] ?? 0,
        $userId
      ]);
      $affected = $stmt->rowCount();
      if ($affected === 1) $inserted++;
      elseif ($affected === 2) $updated++;
      else $skipped++;
    }
    echo json_encode(["success" => true, "data" => [
      "inserted" => $inserted, "updated" => $updated, "skipped" => $skipped
    ]]);
    exit;
  }

  // Legacy single-record support
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
