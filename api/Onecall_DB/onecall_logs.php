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
  error_log("Database connection successful for onecall_logs.php");
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

// Only allow POST requests
if ($_SERVER["REQUEST_METHOD"] !== "POST") {
  json_response(["success" => false, "error" => "Method not allowed"], 405);
}

// Get JSON input
$data = json_input();

// Log incoming data for debugging
error_log("Received data in onecall_logs.php: " . json_encode($data));

// Validate input
if (
  !is_array($data["logs"])
) {
  error_log("Missing required fields or invalid logs data in onecall_logs.php");
  json_response(
    [
      "success" => false,
      "error" => "Missing required fields or invalid logs data",
    ],
    400,
  );
}

$companyId = isset($_GET['company_id']) ? intval($_GET['company_id']) : (isset($data['company_id']) ? intval($data['company_id']) : null);

try {
  // Verify batch ownership logic if company ID is provided
  // This ensures we only add logs to a batch that belongs to the user's company
  if ($companyId) {
      $stmt = $pdo->prepare("SELECT id FROM onecall_batch WHERE id = ? AND company_id = ?");
      $stmt->execute([$data["batch_id"], $companyId]);
      if (!$stmt->fetch()) {
          json_response(["success" => false, "error" => "Batch not found or access denied for this company"], 403);
      }
  }

  // Begin transaction
  $pdo->beginTransaction();

  // Prepare statement for inserting logs with IGNORE to skip duplicates
  $stmt = $pdo->prepare(
    "INSERT IGNORE INTO onecall_log (id, timestamp, duration, localParty, remoteParty, direction, phone_telesale, batch_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  );

  // Prepare statement to check for existing logs
  $checkStmt = $pdo->prepare(
    "SELECT id, timestamp, duration, localParty, remoteParty, direction, phone_telesale FROM onecall_log WHERE id = ?",
  );

  // Insert each log and track duplicates
  $insertedCount = 0;
  $duplicateIds = [];
  $duplicateDetails = [];

  foreach ($data["logs"] as $log) {
    // Validate required fields for each log
    if (
      !isset($log["id"]) ||
      !isset($log["timestamp"]) ||
      !isset($log["duration"]) ||
      !isset($log["localParty"]) ||
      !isset($log["remoteParty"]) ||
      !isset($log["direction"])
    ) {
      throw new Exception("Missing required fields in log data");
    }

    // Check if log already exists
    $checkStmt->execute([$log["id"]]);
    $existingLog = $checkStmt->fetch(PDO::FETCH_ASSOC);

    if ($existingLog) {
      // Log duplicate details
      $duplicateIds[] = $log["id"];
      $duplicateDetails[] = [
        "id" => $log["id"],
        "request_data" => $log,
        "database_data" => $existingLog,
      ];

      // Log to console (via error_log for now)
      error_log(
        "Duplicate log found - ID: {$log["id"]}, Request: " .
          json_encode($log) .
          ", Database: " .
          json_encode($existingLog),
      );
    } else {
      // Insert new log
      $stmt->execute([
        $log["id"],
        $log["timestamp"],
        $log["duration"],
        $log["localParty"],
        $log["remoteParty"],
        $log["direction"],
        isset($log["phone_telesale"]) ? $log["phone_telesale"] : "",
        $data["batch_id"],
      ]);

      $insertedCount++;
    }
  }

  // Commit transaction
  $pdo->commit();

  // Log successful logs insertion
  error_log(
    "Successfully inserted $insertedCount logs for batch ID: " .
      $data["batch_id"],
  );

  if (!empty($duplicateIds)) {
    error_log(
      "Skipped " .
        count($duplicateIds) .
        " duplicate logs. IDs: " .
        implode(", ", $duplicateIds),
    );
  }

  // Return success response with duplicate information
  json_response(
    [
      "success" => true,
      "message" => "Logs saved successfully",
      "count" => $insertedCount,
      "duplicates" => [
        "count" => count($duplicateIds),
        "ids" => $duplicateIds,
        "details" => $duplicateDetails,
      ],
    ],
    201,
  );
} catch (Exception $e) {
  // Rollback transaction on error
  if (isset($pdo) && $pdo->inTransaction()) {
    $pdo->rollBack();
  }

  error_log("Failed to save logs: " . $e->getMessage());
  json_response(
    [
      "success" => false,
      "error" => "Failed to save logs: " . $e->getMessage(),
    ],
    500,
  );
}
?>
