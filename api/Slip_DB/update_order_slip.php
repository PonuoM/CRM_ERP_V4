<?php
header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

// Set UTF-8 encoding
mb_internal_encoding("UTF-8");
mb_http_output("UTF-8");

require_once "../config.php";

// Get JSON input
$json_input = file_get_contents("php://input");
$data = json_decode($json_input, true);

if (!$data) {
  echo json_encode([
    "success" => false,
    "message" => "Invalid JSON data",
  ]);
  exit();
}

// Validate required fields
if (empty($data["id"])) {
  echo json_encode([
    "success" => false,
    "message" => "Slip ID is required",
  ]);
  exit();
}

try {
  // Database connection using PDO with UTF-8
  $conn = db_connect();
  $conn->exec("SET NAMES utf8mb4");
  $conn->exec("SET CHARACTER SET utf8mb4");

  $slip_id = $data["id"];
  $company_id = $data["company_id"] ?? 0;

  // Verify slip exists and belongs to an order of the company
  $check_sql = "SELECT s.id, o.company_id 
                FROM order_slips s 
                JOIN orders o ON s.order_id = o.id 
                WHERE s.id = ?";
  $check_stmt = $conn->prepare($check_sql);
  $check_stmt->execute([$slip_id]);
  $slip = $check_stmt->fetch();

  if (!$slip) {
    echo json_encode([
      "success" => false,
      "message" => "Slip not found",
    ]);
    exit();
  }

  if ($slip["company_id"] != $company_id) {
    echo json_encode([
      "success" => false,
      "message" => "Company ID mismatch",
    ]);
    exit();
  }

  // Build update query dynamically
  $update_fields = [];
  $params = [];

  if (isset($data["amount"])) {
    $update_fields[] = "amount = ?";
    $params[] = (float)$data["amount"];
  }

  if (isset($data["bank_account_id"])) {
    $update_fields[] = "bank_account_id = ?";
    $params[] = (int)$data["bank_account_id"];
  }

  if (isset($data["transfer_date"])) {
    $update_fields[] = "transfer_date = ?";
    $params[] = $data["transfer_date"];
  }

  if (isset($data["url"])) {
    $update_fields[] = "url = ?";
    $params[] = $data["url"];
  }

  if (isset($data["updated_by"])) {
      // Assuming there isn't an updated_by column yet based on insert script, 
      // but if we wanted to track it we could. 
      // For now, let's just update the timestamp which is automatic if defined as ON UPDATE CURRENT_TIMESTAMP
      // Or we can force it if needed.
  }

  if (empty($update_fields)) {
    echo json_encode([
      "success" => true,
      "message" => "No changes to update",
    ]);
    exit();
  }

  $params[] = $slip_id; // For WHERE clause

  $sql = "UPDATE order_slips SET " . implode(", ", $update_fields) . " WHERE id = ?";
  $stmt = $conn->prepare($sql);
  $result = $stmt->execute($params);

  if ($result) {
    echo json_encode([
      "success" => true,
      "message" => "Slip updated successfully",
    ]);
  } else {
    echo json_encode([
      "success" => false,
      "message" => "Failed to update slip",
    ]);
  }

} catch (Exception $e) {
  echo json_encode([
    "success" => false,
    "message" => $e->getMessage(),
  ]);
}
?>
