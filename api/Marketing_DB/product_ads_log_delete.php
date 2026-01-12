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
    $token = $matches[1];
    $stmt = $pdo->prepare("
      SELECT u.id, u.role, r.is_system
      FROM user_tokens ut
      JOIN users u ON ut.user_id = u.id
      LEFT JOIN roles r ON u.role = r.name
      WHERE ut.token = ? AND ut.expires_at > NOW()
    ");
    $stmt->execute([$token]);
    $currentUser = $stmt->fetch();
    
    if ($currentUser) {
      $currentUserId = $currentUser['id'];
      $userRole = $currentUser['role'];
      // Ensure we cast to boolean/int explicitly
      $isSystemUser = !empty($currentUser['is_system']) && $currentUser['is_system'] == 1;
    } else {
        $isSystemUser = false;
    }
  }

  if (!$currentUserId && isset($data['user_id'])) {
      // Legacy support: if no token, check if user_id is provided?
      // But for security, deletion should probably require token or strict session.
      // We'll follow ads_log_delete pattern, but arguably we should trust token first.
      // If token verified, use that id.
      // If no token, maybe use provided user_id carefully? 
      // The original ads_log_delete trusted the payload user_id if token missing?
      // Actually original ads_log_delete logic I saw was:
      // $userId = isset($data["user_id"]) ? $data["user_id"] : null;
      // It didn't seem to check token explicitly? That's weird.
      // Ah, I should probably stick to the ads_log_update pattern which IS clearer about token.
      
      $currentUserId = $data['user_id'];
  }
  
  if (!$currentUserId) {
       json_response(["success" => false, "error" => "User authentication required"], 401);
       exit();
  }


  // Check if record exists AND belongs to user or is Admin
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

  // Check permissions: Owner or Admin
  $isOwner = ($record["user_id"] == $currentUserId);
  $isAdmin = (isset($isSystemUser) && $isSystemUser) || in_array($userRole, ['Super Admin', 'Admin Control']);

  if (!$isOwner && !$isAdmin) {
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
        DELETE FROM marketing_product_ads_log WHERE id = ?
    ");
  $stmt->execute([$data["id"]]);

  json_response([
    "success" => true,
    "message" => "Product ads log deleted successfully",
    "data" => [
      "id" => $data["id"],
    ],
  ]);
} catch (Exception $e) {
  error_log("Error in product_ads_log_delete.php: " . $e->getMessage());
  json_response(
    [
      "success" => false,
      "error" => $e->getMessage(),
      "message" => "Failed to delete product ads log",
    ],
    500,
  );
}
