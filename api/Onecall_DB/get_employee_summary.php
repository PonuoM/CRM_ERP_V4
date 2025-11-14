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

  // Get employee summary data from the call overview view
  $monthKey = sprintf('%04d-%02d', $year, $month);

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
            WHERE month_key = :month_key
            ORDER BY first_name";

  $stmt = $pdo->prepare($sql);
  $stmt->execute([':month_key' => $monthKey]);
  $employees = $stmt->fetchAll(PDO::FETCH_ASSOC);

  json_response([
    'success' => true,
    'month' => $month,
    'year' => $year,
    'data' => $employees
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
 ?>