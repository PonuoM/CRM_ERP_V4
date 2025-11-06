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
  error_log("Database connection successful for onecall_batch_crud.php");
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

// Get request method
$method = $_SERVER["REQUEST_METHOD"];

// Handle different request methods
switch ($method) {
  case "GET":
    // Get all batches or a specific batch
    if (isset($_GET["id"])) {
      // Get a specific batch
      $batchId = $_GET["id"];
      $stmt = $pdo->prepare("SELECT * FROM Onecall_batch WHERE id = ?");
      $stmt->execute([$batchId]);
      $batch = $stmt->fetch(PDO::FETCH_ASSOC);

      if ($batch) {
        json_response(["success" => true, "data" => $batch]);
      } else {
        json_response(["success" => false, "error" => "Batch not found"], 404);
      }
    } else {
      // Get all batches
      $stmt = $pdo->query("SELECT * FROM Onecall_batch ORDER BY id DESC");
      $batches = $stmt->fetchAll(PDO::FETCH_ASSOC);
      json_response(["success" => true, "data" => $batches]);
    }
    break;

  case "POST":
    // Create a new batch
    $data = json_input();

    if (
      !isset($data["startdate"]) ||
      !isset($data["enddate"]) ||
      !isset($data["amount_record"])
    ) {
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
        "SELECT id FROM Onecall_batch WHERE startdate = ? AND enddate = ?",
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
        "INSERT INTO Onecall_batch (startdate, enddate, amount_record) VALUES (?, ?, ?)",
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
    break;

  case "PUT":
    // Update a batch
    if (!isset($_GET["id"])) {
      http_response_code(400);
      echo json_encode(["success" => false, "error" => "Missing batch ID"]);
      exit();
    }

    $batchId = $_GET["id"];
    $data = json_input();

    if (
      !isset($data["startdate"]) ||
      !isset($data["enddate"]) ||
      !isset($data["amount_record"])
    ) {
      json_response(
        ["success" => false, "error" => "Missing required fields"],
        400,
      );
    }

    try {
      // Update batch record
      $stmt = $pdo->prepare(
        "UPDATE Onecall_batch SET startdate = ?, enddate = ?, amount_record = ? WHERE id = ?",
      );
      $stmt->execute([
        $data["startdate"],
        $data["enddate"],
        $data["amount_record"],
        $batchId,
      ]);

      // Check if the batch was updated
      if ($stmt->rowCount() > 0) {
        json_response([
          "success" => true,
          "message" => "Batch updated successfully",
        ]);
      } else {
        json_response(["success" => false, "error" => "Batch not found"], 404);
      }
    } catch (PDOException $e) {
      error_log("Failed to update batch: " . $e->getMessage());
      json_response(
        [
          "success" => false,
          "error" => "Failed to update batch: " . $e->getMessage(),
        ],
        500,
      );
    }
    break;

  case "DELETE":
    // Delete a batch and its associated logs
    if (!isset($_GET["id"])) {
      json_response(["success" => false, "error" => "Missing batch ID"], 400);
    }

    $batchId = $_GET["id"];

    try {
      // Start transaction
      $pdo->beginTransaction();

      // Delete associated logs
      $stmt = $pdo->prepare("DELETE FROM Onecall_Log WHERE batch_id = ?");
      $stmt->execute([$batchId]);
      $deletedLogs = $stmt->rowCount();

      // Delete the batch
      $stmt = $pdo->prepare("DELETE FROM Onecall_batch WHERE id = ?");
      $stmt->execute([$batchId]);

      // Check if the batch was deleted
      if ($stmt->rowCount() > 0) {
        // Commit transaction
        $pdo->commit();
        error_log(
          "Deleted batch with ID: $batchId and $deletedLogs associated logs",
        );
        json_response([
          "success" => true,
          "message" => "Batch and associated logs deleted successfully",
        ]);
      } else {
        // Rollback transaction
        $pdo->rollBack();
        json_response(["success" => false, "error" => "Batch not found"], 404);
      }
    } catch (PDOException $e) {
      // Rollback transaction on error
      if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
      }
      error_log("Failed to delete batch: " . $e->getMessage());
      json_response(
        [
          "success" => false,
          "error" => "Failed to delete batch: " . $e->getMessage(),
        ],
        500,
      );
    }
    break;

  default:
    json_response(["success" => false, "error" => "Method not allowed"], 405);
    break;
}
?>
