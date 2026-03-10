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
  $totalSales = $input['total_sales'] ?? 0;
  $totalOrders = $input['total_orders'] ?? 0;
  $returnsAmount = $input['returns_amount'] ?? 0;
  $cancelledAmount = $input['cancelled_amount'] ?? 0;
  $userId = $input['user_id'] ?? null;

  if (!$storeId || !$date || !$userId) {
    http_response_code(400);
    echo json_encode(["success" => false, "error" => "store_id, date, user_id required"]);
    exit;
  }

  $stmt = $conn->prepare("
    INSERT INTO marketplace_sales_import (store_id, date, total_sales, total_orders, returns_amount, cancelled_amount, user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      total_sales = VALUES(total_sales),
      total_orders = VALUES(total_orders),
      returns_amount = VALUES(returns_amount),
      cancelled_amount = VALUES(cancelled_amount),
      user_id = VALUES(user_id)
  ");
  $stmt->execute([$storeId, $date, $totalSales, $totalOrders, $returnsAmount, $cancelledAmount, $userId]);

  echo json_encode(["success" => true, "message" => "Saved"]);
} catch (Exception $e) {
  http_response_code(500);
  echo json_encode(["success" => false, "error" => $e->getMessage()]);
}
?>
