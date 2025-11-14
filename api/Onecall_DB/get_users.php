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
  error_log("Database connection successful for get_users.php");
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
  // Query to get users with Telesale and Supervisor Telesale roles
  $stmt = $pdo->prepare(
    "SELECT id, first_name, last_name, role FROM users WHERE role IN ('Telesale', 'Supervisor Telesale')",
  );
  $stmt->execute();

  $users = $stmt->fetchAll(PDO::FETCH_ASSOC);

  // Convert keys from snake_case to camelCase for frontend compatibility
  $formattedUsers = array_map(function ($user) {
    return [
      "id" => $user["id"],
      "firstname" => $user["first_name"],
      "lastname" => $user["last_name"],
      "role" => $user["role"],
    ];
  }, $users);

  // Log successful users retrieval
  error_log(
    "Successfully retrieved " .
      count($formattedUsers) .
      " users with Telesale and Supervisor Telesale roles",
  );

  // Return success response with users data
  json_response(["success" => true, "data" => $formattedUsers]);
} catch (PDOException $e) {
  error_log("Failed to retrieve users: " . $e->getMessage());
  json_response(
    [
      "success" => false,
      "error" => "Failed to retrieve users: " . $e->getMessage(),
    ],
    500,
  );
}
?>
