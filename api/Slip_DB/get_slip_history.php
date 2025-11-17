<?php
header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

// Set UTF-8 encoding
mb_internal_encoding("UTF-8");
mb_http_output("UTF-8");

require_once "../config.php";

// Get parameters
$order_id = isset($_GET["order_id"]) ? trim($_GET["order_id"]) : "";
$company_id = isset($_GET["company_id"]) ? (int) $_GET["company_id"] : 0;

if (empty($order_id)) {
  echo json_encode([
    "success" => false,
    "message" => "Order ID is required",
  ]);
  exit();
}

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

  // Query to get slip history with bank account details
  $sql = "SELECT
              os.id,
              os.order_id,
              os.amount,
              os.bank_account_id,
              os.transfer_date,
              os.url,
              os.created_at,
              os.updated_at,
              ba.bank,
              ba.bank_number
          FROM order_slips os
          INNER JOIN orders o ON o.id = os.order_id
          LEFT JOIN bank_account ba ON ba.id = os.bank_account_id
          WHERE os.order_id = ? AND o.company_id = ? AND os.url IS NOT NULL
          ORDER BY os.created_at DESC";

  $stmt = $conn->prepare($sql);
  $stmt->execute([$order_id, $company_id]);

  $slipHistory = [];

  while ($row = $stmt->fetch()) {
    $slipHistory[] = [
      "id" => (int) $row["id"],
      "order_id" => (string) $row["order_id"],
      "amount" => (float) $row["amount"],
      "bank_account_id" => (int) $row["bank_account_id"],
      "bank_name" => (string) ($row["bank"] ?? "N/A"),
      "bank_number" => (string) ($row["bank_number"] ?? "N/A"),
      "transfer_date" => (string) $row["transfer_date"],
      "url" => (string) $row["url"],
      "created_at" => (string) $row["created_at"],
      "updated_at" => (string) $row["updated_at"],
    ];
  }

  // Clean and output JSON response
  $response = [
    "success" => true,
    "data" => $slipHistory,
    "count" => count($slipHistory),
  ];

  echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} catch (Exception $e) {
  $errorResponse = [
    "success" => false,
    "message" => $e->getMessage(),
  ];
  echo json_encode(
    $errorResponse,
    JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
  );
}
?>
