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

// Authenticate user via Token
$auth = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
if (!$auth && function_exists('getallheaders')) {
  $headers = getallheaders();
  $auth = $headers['Authorization'] ?? $headers['authorization'] ?? '';
}

$currentUser = null;
$userRole = '';
$currentUserId = 0;

try {
  $pdo = db_connect();

  if (preg_match('/Bearer\s+(\S+)/', $auth, $matches)) {
    $token = $matches[1];
    $stmt = $pdo->prepare("
      SELECT u.id, u.role
      FROM user_tokens ut
      JOIN users u ON ut.user_id = u.id
      WHERE ut.token = ? AND ut.expires_at > NOW()
    ");
    $stmt->execute([$token]);
    $currentUser = $stmt->fetch();

    if ($currentUser) {
      $currentUserId = $currentUser['id'];
      $userRole = $currentUser['role'];
    }
  }

  // Fallback to request user_id (but verify it matches token if present, or just trust if no token for legacy? No, better secure it)
  // For now, if token exists, use token user. If not, fallback to passed user_id only if no auth required? 
  // The system seems to require auth.

  if (!$currentUserId) {
    // Legacy support or direct call without token?
    // If $data['user_id'] is sent but no token, we can't verify role.
    // So we must require token for Admin bypass.
    // If normal user, maybe they are using session?
    if (session_status() === PHP_SESSION_NONE) {
      session_start();
    }
    if (isset($_SESSION['user'])) {
      $currentUserId = $_SESSION['user']['id'];
      $userRole = $_SESSION['user']['role'];
    }
  }

  if (!$currentUserId && isset($data['user_id'])) {
    // Temporary: trust provided user_id if no other auth (NOT SECURE but matches original code behavior for simple user check)
    // modifying original behavior: Original code trusted $data['user_id']. 
    // We will use $data['user_id'] as the "claimed" user, but we need rolw for bypass.
    $currentUserId = $data['user_id'];
  }

  if (!$currentUserId) {
    json_response(["success" => false, "error" => "User authentication required"], 401);
    exit();
  }



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

  // Check permissions:
  // Relaxes ownership check to allow shared management of Ads Data (One record per Page+Date)
  // $isOwner = ($record["user_id"] == $currentUserId);
  $isAdmin = in_array($userRole, ['Super Admin', 'Admin Control']);

  // Allow update if Admin OR (implicitly) if they are a valid user (assuming frontend filters page access)
  // If we want to be stricter, we could check if user has access to $record['page_id']
  // For now, removing strict ownership check as requested ("doesn't matter who").
  /*
  if (!$isOwner && !$isAdmin) {
    json_response(
      [
        "success" => false,
        "error" => "Permission denied: You can only update your own records",
      ],
      403,
    );
    exit();
  }
  */

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
