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
  error_log("Database connection successful for get_employee_summary.php");
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
  $companyId = isset($_GET["company_id"]) ? intval($_GET["company_id"]) : null;

  // Get employee summary data from the call overview view
  $monthKey = sprintf("%04d-%02d", $year, $month);

  $sql = "SELECT
                user_id,
                first_name,
                role,
                phone,
                working_days,
                total_minutes,
                connected_calls,
                total_calls,
                minutes_per_workday
            FROM v_telesale_call_overview_monthly
            WHERE month_key = :month_key";

  $params = [":month_key" => $monthKey];

  // If a specific user is selected, add filter for that user
  if (!empty($userId)) {
    $sql .= " AND user_id = :user_id";
    $params[":user_id"] = $userId;
  } elseif (!empty($companyId)) {
    // Filter by Company Users using subquery
    $sql .= " AND user_id IN (SELECT id FROM users WHERE company_id = :comp_id)";
    $params[":comp_id"] = $companyId;
  }

  $sql .= " ORDER BY first_name";

  $stmt = $pdo->prepare($sql);
  $stmt->execute($params);
  $employees = $stmt->fetchAll(PDO::FETCH_ASSOC);

  json_response([
    "success" => true,
    "month" => $month,
    "year" => $year,
    "data" => $employees,
  ]);
} catch (PDOException $e) {
  error_log("Failed to retrieve employee summary: " . $e->getMessage());
  json_response(
    [
      "success" => false,
      "error" => "Failed to retrieve employee summary: " . $e->getMessage(),
    ],
    500,
  );
}
?>
