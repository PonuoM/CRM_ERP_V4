<?php
header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
  http_response_code(204);
  exit();
}

require_once "../config.php";

$subOrderId = isset($_GET['sub_order_id']) ? trim($_GET['sub_order_id']) : '';

if (empty($subOrderId)) {
  http_response_code(400);
  echo json_encode([
    "success" => false,
    "error" => "sub_order_id is required"
  ], JSON_UNESCAPED_UNICODE);
  exit();
}

try {
  $pdo = db_connect();
  $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
  
  // Find parent order ID from order_boxes table
  $stmt = $pdo->prepare("
    SELECT order_id as parent_order_id
    FROM order_boxes
    WHERE sub_order_id = :subOrderId
    LIMIT 1
  ");
  
  $stmt->execute([':subOrderId' => $subOrderId]);
  $result = $stmt->fetch(PDO::FETCH_ASSOC);
  
  if ($result) {
    echo json_encode([
      "success" => true,
      "parent_order_id" => $result['parent_order_id'],
      "sub_order_id" => $subOrderId
    ], JSON_UNESCAPED_UNICODE);
  } else {
    // Not found in order_boxes, might be a regular order
    echo json_encode([
      "success" => false,
      "error" => "Sub-order not found in order_boxes",
      "sub_order_id" => $subOrderId
    ], JSON_UNESCAPED_UNICODE);
  }
} catch (PDOException $e) {
  http_response_code(500);
  echo json_encode([
    "success" => false,
    "error" => "Database error: " . $e->getMessage()
  ], JSON_UNESCAPED_UNICODE);
}
