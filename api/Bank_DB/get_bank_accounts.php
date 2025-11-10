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
$company_id = isset($_GET["company_id"]) ? (int) $_GET["company_id"] : 0;

if ($company_id <= 0) {
  echo json_encode([
    "success" => false,
    "message" => "Company ID is required",
  ]);
  exit();
}

try {
  // Database connection using PDO with UTF-8
  $conn = db_connect();
  $conn->exec("SET NAMES utf8mb4");
  $conn->exec("SET CHARACTER SET utf8mb4");

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

  $bankAccounts = [];

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

  echo json_encode(
    [
      "success" => true,
      "data" => $bankAccounts,
      "count" => count($bankAccounts),
    ],
    JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
  );
} catch (Exception $e) {
  echo json_encode(
    [
      "success" => false,
      "message" => $e->getMessage(),
    ],
    JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
  );
}
?>
