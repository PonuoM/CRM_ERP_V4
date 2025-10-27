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

  // Check if record exists AND belongs to the user
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

  // Check if the record belongs to the current user
  if ($record["user_id"] != $userId) {
    json_response(
      [
        "success" => false,
        "error" => "Permission denied: You can only update your own records",
      ],
      403,
    );
    exit();
  }

  // Build dynamic update query
  $updateFields = [];
  $updateValues = [];

  $optionalFields = [
    "page_id",
    "date",
    "ads_cost",
    "impressions",
    "reach",
    "clicks",
  ];
  // Note: removed 'user_id' from allowed fields to prevent changing ownership

  foreach ($optionalFields as $field) {
    if (array_key_exists($field, $data)) {
      $updateFields[] = "`{$field}` = ?";
      if ($data[$field] === null || $data[$field] === "") {
        $updateValues[] = null;
      } else {
        $updateValues[] = $data[$field];
      }
    }
  }

  if (empty($updateFields)) {
    json_response(
      [
        "success" => false,
        "error" => "No fields to update",
      ],
      400,
    );
    exit();
  }

  // Add updated_at field
  $updateFields[] = "`updated_at` = CURRENT_TIMESTAMP";
  $updateValues[] = $data["id"];

  $sql =
    "
        UPDATE marketing_ads_log
        SET " .
    implode(", ", $updateFields) .
    "
        WHERE id = ?
    ";

  $stmt = $pdo->prepare($sql);
  $stmt->execute($updateValues);

  json_response([
    "success" => true,
    "message" => "Ads log updated successfully",
    "data" => [
      "id" => $data["id"],
      "updated_fields" => array_keys($data),
    ],
  ]);
} catch (Exception $e) {
  error_log("Error in ads_log_update.php: " . $e->getMessage());
  json_response(
    [
      "success" => false,
      "error" => $e->getMessage(),
      "message" => "Failed to update ads log",
    ],
    500,
  );
}
