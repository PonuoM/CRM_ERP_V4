<?php
header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

// Set UTF-8 encoding
mb_internal_encoding("UTF-8");
mb_http_output("UTF-8");

require_once "../config.php";

// Get company_id from query parameter
try {
  // Database connection using PDO with UTF-8
  $conn = db_connect();
  $conn->exec("SET NAMES utf8mb4");
  $conn->exec("SET CHARACTER SET utf8mb4");

  // Authenticate
  $user = get_authenticated_user($conn);
  if (!$user) {
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit();
  }
  
  $company_id = $user['company_id'];

  // Check if bank_account table exists
  $table_exists = $conn->query("SELECT COUNT(*) FROM information_schema.tables 
    WHERE table_schema = DATABASE() AND table_name = 'bank_account'")->fetchColumn();

  $bankAccounts = [];

  if ($table_exists > 0) {
    // Query to get active bank accounts for the company
    $sql = "SELECT
              id,
              bank,
              bank_number,
              is_active,
              created_at,
              updated_at
            FROM bank_account
            WHERE company_id = ? AND is_active = 1 AND deleted_at IS NULL
            ORDER BY bank ASC, bank_number ASC";

    $stmt = $conn->prepare($sql);
    $stmt->execute([$company_id]);

    while ($row = $stmt->fetch()) {
      $bankAccounts[] = [
        "id" => $row["id"],
        "bank" => $row["bank"],
        "bank_number" => $row["bank_number"],
        "is_active" => (bool) $row["is_active"],
        "display_name" => $row["bank"] . " - " . $row["bank_number"],
        "created_at" => $row["created_at"],
        "updated_at" => $row["updated_at"],
      ];
    }
  }
  // If table doesn't exist, return empty array (no error)

  echo json_encode(
    [
      "success" => true,
      "data" => $bankAccounts,
      "count" => count($bankAccounts),
    ],
    JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
  );
} catch (Exception $e) {
  // Silently handle errors - return empty array instead of showing error
  echo json_encode(
    [
      "success" => true,
      "data" => [],
      "count" => 0,
    ],
    JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
  );
}
?>
