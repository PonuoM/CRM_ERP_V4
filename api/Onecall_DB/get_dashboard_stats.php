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
  error_log("Database connection successful for get_dashboard_stats.php");
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
  // Get month and year from query parameters
  $month = isset($_GET["month"]) ? intval($_GET["month"]) : intval(date("m"));
  $year = isset($_GET["year"]) ? intval($_GET["year"]) : intval(date("Y"));

  // Calculate total calls
  $stmt = $pdo->prepare(
    "SELECT COUNT(*) as total_calls FROM onecall_log WHERE MONTH(timestamp) = ? AND YEAR(timestamp) = ?",
  );
  $stmt->execute([$month, $year]);
  $totalCalls = $stmt->fetch(PDO::FETCH_ASSOC)["total_calls"];

  // Calculate total duration in seconds and convert to minutes directly in SQL
  $stmt = $pdo->prepare(
    "SELECT SUM(duration) / 60 as total_duration_minutes FROM onecall_log WHERE MONTH(timestamp) = ? AND YEAR(timestamp) = ?",
  );
  $stmt->execute([$month, $year]);
  $totalMinutes = floor(
    $stmt->fetch(PDO::FETCH_ASSOC)["total_duration_minutes"] ?: 0,
  );

  // Calculate business days (excluding weekends)
  $businessDays = 0;
  $currentDay = intval(date("d"));
  $currentMonth = intval(date("m"));
  $currentYear = intval(date("Y"));

  // If we're in the same month, count only days up to today
  $daysInMonth =
    $month == $currentMonth && $year == $currentYear
      ? $currentDay
      : cal_days_in_month(CAL_GREGORIAN, $month, $year);

  for ($day = 1; $day <= $daysInMonth; $day++) {
    $dayOfWeek = date("N", mktime(0, 0, 0, $month, $day, $year));
    // 6 = Saturday, 7 = Sunday
    if ($dayOfWeek < 6) {
      $businessDays++;
    }
  }

  // Calculate average minutes per business day
  $avgMinutesPerDay =
    $businessDays > 0 ? round($totalMinutes / $businessDays, 2) : 0;

  // Return success response with stats
  json_response([
    "success" => true,
    "data" => [
      "totalCalls" => $totalCalls,
      "answeredCalls" => 0, // Always 0 as requested
      "totalMinutes" => $totalMinutes,
      "avgMinutes" => $avgMinutesPerDay,
      "businessDays" => $businessDays,
    ],
  ]);
} catch (PDOException $e) {
  error_log("Failed to retrieve dashboard stats: " . $e->getMessage());
  json_response(
    [
      "success" => false,
      "error" => "Failed to retrieve dashboard stats: " . $e->getMessage(),
    ],
    500,
  );
}
?>
