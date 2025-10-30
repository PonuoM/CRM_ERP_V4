<?php
require_once __DIR__ . "/config.php";

// Enable CORS
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

// Handle preflight OPTIONS request
if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
  exit(0);
}

// Only allow POST requests
if ($_SERVER["REQUEST_METHOD"] !== "POST") {
  http_response_code(405);
  echo json_encode(["error" => "Method not allowed"]);
  exit();
}

try {
  // Connect to database
  $pdo = db_connect();

  // Get JSON input
  $input = json_decode(file_get_contents("php://input"), true);

  if (!$input) {
    http_response_code(400);
    echo json_encode(["error" => "ข้อมูล JSON ไม่ถูกต้อง"]);
    exit();
  }

  $userId = $input["userId"] ?? null;
  $currentPassword = $input["currentPassword"] ?? null;
  $newPassword = $input["newPassword"] ?? null;
  $confirmPassword = $input["confirmPassword"] ?? null;

  // Validate required fields
  if (!$userId || !$currentPassword || !$newPassword || !$confirmPassword) {
    http_response_code(400);
    echo json_encode(["error" => "กรุณากรอกข้อมูลให้ครบถ้วน"]);
    exit();
  }

  // Validate new password matches confirmation
  if ($newPassword !== $confirmPassword) {
    http_response_code(400);
    echo json_encode(["error" => "รหัสผ่านใหม่และยืนยันรหัสผ่านไม่ตรงกัน"]);
    exit();
  }

  // Password length validation removed - no minimum length requirement

  $pdo->beginTransaction();

  // Get current user data
  $selectSQL =
    "SELECT id, password FROM users WHERE id = ? AND status = 'active'";
  $stmt = $pdo->prepare($selectSQL);
  $stmt->execute([$userId]);
  $user = $stmt->fetch(PDO::FETCH_ASSOC);

  if (!$user) {
    $pdo->rollBack();
    http_response_code(404);
    echo json_encode(["error" => "ไม่พบผู้ใช้หรือผู้ใช้ไม่ได้ใช้งานอยู่"]);
    exit();
  }

  // Verify current password
  if ($user["password"] !== $currentPassword) {
    $pdo->rollBack();
    http_response_code(400);
    echo json_encode(["error" => "รหัสผ่านปัจจุบันไม่ถูกต้อง"]);
    exit();
  }

  // Check if new password is same as current password
  if ($user["password"] === $newPassword) {
    $pdo->rollBack();
    http_response_code(400);
    echo json_encode([
      "error" => "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านปัจจุบัน",
    ]);
    exit();
  }

  // Update password
  $updateSQL =
    "UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?";
  $stmt = $pdo->prepare($updateSQL);
  $result = $stmt->execute([$newPassword, $userId]);

  if ($result && $stmt->rowCount() > 0) {
    $pdo->commit();
    echo json_encode([
      "ok" => true,
      "message" => "Password changed successfully",
      "userId" => $userId,
    ]);
  } else {
    $pdo->rollBack();
    http_response_code(500);
    echo json_encode(["error" => "ไม่สามารถอัพเดตรหัสผ่านได้"]);
  }
} catch (Throwable $e) {
  if (isset($pdo) && $pdo->inTransaction()) {
    $pdo->rollBack();
  }

  http_response_code(500);
  echo json_encode([
    "error" => "เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน",
    "message" => $e->getMessage(),
  ]);
}
?>
