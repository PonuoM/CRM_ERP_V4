<?php
require_once __DIR__ . "/../config.php";

cors();

try {
  // Get input data
  $input = json_decode(file_get_contents("php://input"), true);
  $pageUserId = $input["pageUserId"] ?? null;

  // Validate input
  if (!$pageUserId) {
    json_response(
      [
        "success" => false,
        "error" => "Missing required parameter: pageUserId",
      ],
      400,
    );
    return;
  }

  $pdo = db_connect();

  // Update page_user record to set user_id to NULL
  $stmt = $pdo->prepare("
        UPDATE page_user
        SET user_id = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    ");

  $result = $stmt->execute([$pageUserId]);

  if (!$result) {
    json_response(
      [
        "success" => false,
        "error" => "Failed to update page_user record",
      ],
      500,
    );
    return;
  }

  // Check if any rows were affected
  if ($stmt->rowCount() === 0) {
    json_response(
      [
        "success" => false,
        "error" => "page_user not found or already disconnected",
      ],
      404,
    );
    return;
  }

  json_response([
    "success" => true,
    "ok" => true,
    "message" => "page_user disconnected successfully",
  ]);
} catch (Exception $e) {
  error_log("Error in disconnect_page_user.php: " . $e->getMessage());
  json_response(
    [
      "success" => false,
      "error" => $e->getMessage(),
      "message" => "Failed to disconnect page user",
    ],
    500,
  );
}
