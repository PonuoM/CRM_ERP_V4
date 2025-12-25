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

  if (!$currentUserId) {
      if (session_status() === PHP_SESSION_NONE) {
        session_start();
      }
      if (isset($_SESSION['user'])) {
          $currentUserId = $_SESSION['user']['id'];
          $userRole = $_SESSION['user']['role'];
      }
  }

  if (!$currentUserId && isset($data['user_id'])) {
      // Temporary fallback
      $currentUserId = $data['user_id'];
  }

  if (!$currentUserId) {
      json_response(["success" => false, "error" => "User authentication required"], 401);
      exit();
  }

  // Check if record exists AND belongs to the user
  $checkStmt = $pdo->prepare("
        SELECT id, user_id FROM marketing_product_ads_log WHERE id = ?
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
  // 1. Owner can update their own record
  // 2. Super Admin / Admin Control can update any record
  $isOwner = ($record["user_id"] == $currentUserId);
  $isAdmin = in_array($userRole, ['Super Admin', 'Admin Control']);

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

  // Build dynamic update query
  $updateFields = [];
  $updateValues = [];

  $optionalFields = [
    "product_id",
    "date",
    "ads_cost",
    "impressions",
    "reach",
    "clicks",
  ];

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
        UPDATE marketing_product_ads_log
        SET " .
    implode(", ", $updateFields) .
    "
        WHERE id = ?
    ";

  $stmt = $pdo->prepare($sql);
  $stmt->execute($updateValues);

  json_response([
    "success" => true,
    "message" => "Product ads log updated successfully",
    "data" => [
      "id" => $data["id"],
      "updated_fields" => array_keys($data),
    ],
  ]);
} catch (Exception $e) {
  error_log("Error in product_ads_log_update.php: " . $e->getMessage());
  json_response(
    [
      "success" => false,
      "error" => $e->getMessage(),
      "message" => "Failed to update product ads log",
    ],
    500,
  );
}
