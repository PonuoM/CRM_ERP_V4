<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
  exit(0);
}

try {
  require_once "../config.php";

  // Get database connection using PDO
  $conn = db_connect();

  // Get the key parameter from query string
  $key = $_GET["key"] ?? null;

  if (!$key) {
    http_response_code(400);
    echo json_encode([
      "success" => false,
      "error" => "Missing required parameter: key",
    ]);
    exit();
  }

  // Prepare statement to get value from env table
  $stmt = $conn->prepare("SELECT `value` FROM `env` WHERE `key` = ?");
  if ($stmt === false) {
    throw new Exception("Query preparation failed");
  }

  $stmt->execute([$key]);
  $result = $stmt->fetch(PDO::FETCH_ASSOC);

  if ($result) {
    echo json_encode([
      "success" => true,
      "key" => $key,
      "value" => $result["value"],
    ]);
  } else {
    echo json_encode([
      "success" => false,
      "error" => "Environment variable not found for key: " . $key,
    ]);
  }
} catch (Exception $e) {
  http_response_code(500);
  echo json_encode([
    "success" => false,
    "error" => $e->getMessage(),
  ]);
}
?>
