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

  // Check if record exists for this Product + Date (Any User)
  $checkParams = [$log['product_id'], $log['date']];
  $checkSql = "SELECT id, user_id FROM marketing_product_ads_log WHERE product_id = ? AND date = ?";
  $checkStmt = $conn->prepare($checkSql);
  $checkStmt->execute($checkParams);
  $existing = $checkStmt->fetch(PDO::FETCH_ASSOC);

  if ($existing) {
    // Update existing record
    $updateSql = "UPDATE marketing_product_ads_log SET ads_cost = ?, impressions = ?, reach = ?, clicks = ? WHERE id = ?";
    $updateStmt = $conn->prepare($updateSql);
    $updateStmt->execute([
      !empty($log['ads_cost']) ? $log['ads_cost'] : 0,
      !empty($log['impressions']) ? $log['impressions'] : 0,
      !empty($log['reach']) ? $log['reach'] : 0,
      !empty($log['clicks']) ? $log['clicks'] : 0,
      $existing['id']
    ]);
  } else {
    // Insert new record
    $insertSql = "INSERT INTO marketing_product_ads_log (user_id, product_id, date, ads_cost, impressions, reach, clicks) VALUES (?, ?, ?, ?, ?, ?, ?)";
    $insertStmt = $conn->prepare($insertSql);
    $insertStmt->execute([
      $log['user_id'] ?? $input['user_id'],
      $log['product_id'],
      $log['date'],
      !empty($log['ads_cost']) ? $log['ads_cost'] : null,
      !empty($log['impressions']) ? $log['impressions'] : null,
      !empty($log['reach']) ? $log['reach'] : null,
      !empty($log['clicks']) ? $log['clicks'] : null
    ]);
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