<?php
require_once __DIR__ . "/../config.php";

cors();

// Get POST data
$json = file_get_contents("php://input");
$data = json_decode($json, true);

if (!$data) {
  json_response(
    [
      "success" => false,
      "error" => "Invalid JSON data",
    ],
    400,
  );
  exit();
}

// Validate required fields
if (empty($data["id"])) {
  json_response(
    [
      "success" => false,
      "error" => "Missing required field: id",
    ],
    400,
  );
  exit();
}

// Get user_id from session or request (adjust based on your auth system)
$userId = isset($data["user_id"]) ? $data["user_id"] : null;
if (!$userId) {
  // If no user_id in request, you might need to get from session
  // $userId = $_SESSION['user_id'] ?? null;
  json_response(
    [
      "success" => false,
      "error" => "User authentication required",
    ],
    401,
  );
  exit();
}

try {
  $pdo = db_connect();

  // Check if record exists AND belongs to user
  $checkStmt = $pdo->prepare("
        SELECT id, user_id FROM marketing_ads_log WHERE id = ?
    ");
  $checkStmt->execute([$data["id"]]);
  $record = $checkStmt->fetch();

  if (!$record) {
    json_response(
      [
        "success" => false,
        "error" => "Record not found",
      ],
      404,
    );
    exit();
  }

  // Check if record belongs to current user
  if ($record["user_id"] != $userId) {
    json_response(
      [
        "success" => false,
        "error" => "Permission denied: You can only delete your own records",
      ],
      403,
    );
    exit();
  }

  // Delete the record
  $stmt = $pdo->prepare("
        DELETE FROM marketing_ads_log WHERE id = ?
    ");
  $stmt->execute([$data["id"]]);

  json_response([
    "success" => true,
    "message" => "Ads log deleted successfully",
    "data" => [
      "id" => $data["id"],
    ],
  ]);
} catch (Exception $e) {
  error_log("Error in ads_log_delete.php: " . $e->getMessage());
  json_response(
    [
      "success" => false,
      "error" => $e->getMessage(),
      "message" => "Failed to delete ads log",
    ],
    500,
  );
}
