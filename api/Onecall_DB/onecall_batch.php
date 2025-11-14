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
  error_log("Database connection successful for onecall_batch.php");
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
error_log("Received data in onecall_batch.php: " . json_encode($data));

// Validate input
if (
  !isset($data["startdate"]) ||
  !isset($data["enddate"]) ||
  !isset($data["amount_record"])
) {
  error_log("Missing required fields in onecall_batch.php");
  json_response(
    ["success" => false, "error" => "Missing required fields"],
    400,
  );
}

try {
  // Check for exact matching batches and don't create duplicates
  error_log(
    "Checking for exact matching batches with startdate: {$data["startdate"]}, enddate: {$data["enddate"]}",
  );
  $stmt = $pdo->prepare(
    "SELECT id FROM onecall_batch WHERE startdate = ? AND enddate = ?",
  );
  $stmt->execute([$data["startdate"], $data["enddate"]]);
  $existingBatch = $stmt->fetch(PDO::FETCH_ASSOC);

  if ($existingBatch) {
    error_log(
      "Batch with the same date range already exists with ID: {$existingBatch["id"]}",
    );
    json_response([
      "success" => true,
      "id" => $existingBatch["id"],
      "existing" => true,
    ]);
  }

  // Insert batch record
  $stmt = $pdo->prepare(
    "INSERT INTO onecall_batch (startdate, enddate, amount_record) VALUES (?, ?, ?)",
  );
  $stmt->execute([
    $data["startdate"],
    $data["enddate"],
    $data["amount_record"],
  ]);

  // Get the ID of the inserted record
  $batchId = $pdo->lastInsertId();

  // Log successful batch creation
  error_log("Batch created successfully with ID: $batchId");

  // Return success response with the batch ID
  json_response(
    ["success" => true, "id" => $batchId, "existing" => false],
    201,
  );
} catch (PDOException $e) {
  error_log("Failed to save batch: " . $e->getMessage());
  json_response(
    [
      "success" => false,
      "error" => "Failed to save batch: " . $e->getMessage(),
    ],
    500,
  );
}
?>
