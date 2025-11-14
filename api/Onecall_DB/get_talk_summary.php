<?php
// Enable error reporting for debugging
error_reporting(E_ALL);
ini_set("display_errors", 1);

// Load config file
require_once __DIR__ . "/../config.php";

// Set CORS headers
cors();

// Database connection using config
try {
  $pdo = db_connect();
  error_log("Database connection successful for get_talk_summary.php");
} catch (RuntimeException $e) {
  error_log("Database connection failed: " . $e->getMessage());
  json_response(
    [
      "success" => false,
      "error" => "Database connection failed: " . $e->getMessage(),
    ],
    500,
  );
}

// Only allow GET requests
if ($_SERVER["REQUEST_METHOD"] !== "GET") {
  json_response(["success" => false, "error" => "Method not allowed"], 405);
}

try {
  $month = isset($_GET["month"]) ? intval($_GET["month"]) : intval(date("m"));
  $year = isset($_GET["year"]) ? intval($_GET["year"]) : intval(date("Y"));
  $userId = isset($_GET["user_id"]) ? intval($_GET["user_id"]) : null;
  $threshold = 40; // seconds

  $userFirstName = null;
  $additionalWhere = "";

  if (!empty($userId)) {
    $uStmt = $pdo->prepare(
      "SELECT first_name FROM users WHERE id = :uid LIMIT 1",
    );
    $uStmt->execute([":uid" => $userId]);
    $row = $uStmt->fetch(PDO::FETCH_ASSOC);
    if ($row && !empty($row["first_name"])) {
      $userFirstName = $row["first_name"];
      $additionalWhere = " AND phone_telesale = :firstname";
    }
  }

  // Use a simpler SQL query approach
  $sql = "SELECT
                SUM(CASE WHEN duration >= {$threshold} THEN 1 ELSE 0 END) AS talked,
                SUM(CASE WHEN duration < {$threshold} THEN 1 ELSE 0 END) AS not_talked
            FROM onecall_log
            WHERE YEAR(`timestamp`) = :year AND MONTH(`timestamp`) = :month
            {$additionalWhere}";

  $params = [":year" => $year, ":month" => $month];

  if (!empty($userFirstName)) {
    $params[":firstname"] = $userFirstName;
  }

  // Log SQL and parameters for debugging
  error_log("SQL Query: " . $sql);
  error_log("Parameters: " . json_encode($params));

  $stmt = $pdo->prepare($sql);
  $stmt->execute($params);
  $row = $stmt->fetch(PDO::FETCH_ASSOC) ?: ["talked" => 0, "not_talked" => 0];

  json_response([
    "success" => true,
    "month" => $month,
    "year" => $year,
    "threshold" => $threshold,
    "data" => [
      "talked" => intval($row["talked"] ?? 0),
      "not_talked" => intval($row["not_talked"] ?? 0),
    ],
  ]);
} catch (PDOException $e) {
  error_log("Failed to retrieve talk summary: " . $e->getMessage());
  json_response(
    [
      "success" => false,
      "error" => "Failed to retrieve talk summary: " . $e->getMessage(),
    ],
    500,
  );
}
?>
