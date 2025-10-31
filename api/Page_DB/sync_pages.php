<?php
require_once __DIR__ . "/../config.php";

// Enable CORS
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

// Handle preflight OPTIONS request
if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
  exit(0);
}

// Only allow POST requests
if ($_SERVER["REQUEST_METHOD"] !== "POST") {
  http_response_code(405);
  echo json_encode(["error" => "Method not allowed"]);
  exit();
}

try {
  // Connect to database
  $pdo = db_connect();

  // Get JSON input
  $input = json_decode(file_get_contents("php://input"), true);

  if (!$input) {
    http_response_code(400);
    echo json_encode(["error" => "Invalid JSON input"]);
    exit();
  }

  $pages = $input["pages"] ?? [];
  $companyId = $input["companyId"] ?? null;

  if (empty($pages) || !$companyId) {
    http_response_code(400);
    echo json_encode(["error" => "pages and companyId are required"]);
    exit();
  }

  $pdo->beginTransaction();

  $insertedCount = 0;
  $updatedCount = 0;
  $skippedCount = 0;
  $errorCount = 0;

  // Arrays to store SQL commands
  $insertSQLs = [];
  $updateSQLs = [];

  // Array to store error details
  $errorDetails = [];

  // Get existing pages from database
  $existingPages = [];
  $existingStmt = $pdo->prepare(
    "SELECT page_id FROM pages WHERE company_id = ?",
  );
  $existingStmt->execute([$companyId]);
  $existingResults = $existingStmt->fetchAll(PDO::FETCH_ASSOC);
  foreach ($existingResults as $row) {
    $existingPages[] = $row["page_id"];
  }

  // Collect page IDs from the API response
  $apiPageIds = [];
  foreach ($pages as $page) {
    if (isset($page["id"])) {
      $apiPageIds[] = $page["id"];
    }
  }

  // First, set only pancake pages to still_in_list = 0
  $resetSQL =
    "UPDATE pages SET still_in_list = 0 WHERE company_id = ? AND page_type = 'pancake'";
  $resetStmt = $pdo->prepare($resetSQL);
  $resetStmt->execute([$companyId]);

  // Then, process pages from API response and set still_in_list = 1
  foreach ($pages as $index => $page) {
    $pageId = $page["id"] ?? null;
    $name = $page["name"] ?? "";
    $platform = $page["platform"] ?? "";
    $isActive = isset($page["is_activated"])
      ? ($page["is_activated"]
        ? 1
        : 0)
      : 0;
    $userCount = isset($page["user_count"]) ? (int) $page["user_count"] : 0;
    $pageType = $page["page_type"] ?? null;

    // Pages from API always have still_in_list = 1
    $stillInList = 1;

    // Log the page data for debugging
    error_log("Processing page $index: " . json_encode($page));

    if (!$pageId || !$name) {
      error_log("Skipping page $index: missing id or name");
      $skippedCount++;
      continue;
    }

    // Check if page exists in database
    $pageExists = in_array($pageId, $existingPages);

    if ($pageExists) {
      // Generate UPDATE SQL using prepared statement
      $updateSQL =
        "UPDATE pages SET name = ?, platform = ?, page_type = ?, active = ?, still_in_list = ?, user_count = ? WHERE page_id = ? AND company_id = ?";
      $updateSQLs[] =
        $updateSQL .
        " [VALUES: '{$name}', '{$platform}', '{$pageType}', {$isActive}, {$stillInList}, {$userCount}, '{$pageId}', {$companyId}]";

      try {
        $stmt = $pdo->prepare($updateSQL);
        $result = $stmt->execute([
          $name,
          $platform,
          $pageType,
          $isActive,
          $stillInList,
          $userCount,
          $pageId,
          $companyId,
        ]);

        if ($result) {
          if ($stmt->rowCount() > 0) {
            $updatedCount++;
            error_log(
              "Successfully updated page: $pageId, still_in_list: {$stillInList}, user_count: {$userCount}",
            );
          } else {
            error_log("No changes needed for page: $pageId");
          }
        } else {
          error_log("Failed to update page: $pageId");
          $errorCount++;
        }
      } catch (Exception $e) {
        error_log("Error updating page $pageId: " . $e->getMessage());
        $errorCount++;
        $errorDetails[] = [
          "pageId" => $pageId,
          "operation" => "update",
          "sql" =>
            $updateSQL .
            " [VALUES: '{$name}', '{$platform}', {$isActive}, {$stillInList}, {$userCount}, '{$pageId}', {$companyId}]",
          "error" => $e->getMessage(),
        ];
      }
    } else {
      // Generate INSERT SQL using prepared statement
      $insertSQL =
        "INSERT INTO pages (page_id, name, platform, page_type, company_id, active, still_in_list, user_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
      $insertSQLs[] =
        $insertSQL .
        " [VALUES: '{$pageId}', '{$name}', '{$platform}', '{$pageType}', {$companyId}, {$isActive}, {$stillInList}, {$userCount}]";

      try {
        $stmt = $pdo->prepare($insertSQL);
        $result = $stmt->execute([
          $pageId,
          $name,
          $platform,
          $pageType,
          $companyId,
          $isActive,
          $stillInList,
          $userCount,
        ]);

        if ($result) {
          if ($stmt->rowCount() > 0) {
            $insertedCount++;
            error_log(
              "Successfully inserted page: $pageId, still_in_list: {$stillInList}, user_count: {$userCount}",
            );
          } else {
            error_log("Failed to insert page: $pageId");
            $errorCount++;
          }
        } else {
          error_log("Failed to insert page: $pageId");
          $errorCount++;
        }
      } catch (Exception $e) {
        error_log("Error inserting page $pageId: " . $e->getMessage());
        $errorCount++;
        $errorDetails[] = [
          "pageId" => $pageId,
          "operation" => "insert",
          "sql" =>
            $insertSQL .
            " [VALUES: '{$pageId}', '{$name}', '{$platform}', {$companyId}, {$isActive}, {$stillInList}, {$userCount}]",
          "error" => $e->getMessage(),
        ];
      }
    }
  }

  $pdo->commit();

  echo json_encode([
    "ok" => true,
    "synced" => count($pages),
    "inserted" => $insertedCount,
    "updated" => $updatedCount,
    "skipped" => $skippedCount,
    "errors" => $errorCount,
    "errorDetails" => $errorDetails,
    "insertSQLs" => $insertSQLs,
    "updateSQLs" => $updateSQLs,
  ]);
} catch (Throwable $e) {
  if (isset($pdo) && $pdo->inTransaction()) {
    $pdo->rollBack();
  }

  http_response_code(500);
  echo json_encode(["error" => "SYNC_FAILED", "message" => $e->getMessage()]);
}
?>
