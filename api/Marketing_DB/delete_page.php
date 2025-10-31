<?php
require_once __DIR__ . "/../config.php";

cors();

try {
  // Get page ID from URL parameter or JSON input
  $pageId = null;

  // Check if page_id is in URL query parameters
  if (isset($_GET["page_id"])) {
    $pageId = (int) $_GET["page_id"];
  }

  // Check if page_id is in JSON body
  if (!$pageId) {
    $input = json_input();
    if (!empty($input["page_id"])) {
      $pageId = (int) $input["page_id"];
    }
  }

  // Validate page_id
  if (!$pageId) {
    json_response(
      [
        "success" => false,
        "error" => "Page ID is required",
      ],
      400,
    );
  }

  // Get company_id from query parameter or JSON input
  $companyId = null;
  if (isset($_GET["company_id"])) {
    $companyId = (int) $_GET["company_id"];
  } elseif (!empty($input["company_id"])) {
    $companyId = (int) $input["company_id"];
  }

  // Connect to database
  $pdo = db_connect();

  // Start transaction
  $pdo->beginTransaction();

  try {
    // Check if page exists and belongs to the company (if company_id is provided)
    if ($companyId) {
      $checkStmt = $pdo->prepare("
            SELECT id, name, page_type FROM pages
            WHERE id = ? AND company_id = ?
        ");
      $checkStmt->execute([$pageId, $companyId]);
    } else {
      $checkStmt = $pdo->prepare("
            SELECT id, name, page_type FROM pages
            WHERE id = ?
        ");
      $checkStmt->execute([$pageId]);
    }

    $page = $checkStmt->fetch();

    if (!$page) {
      throw new Exception(
        "Page not found or you do not have permission to delete it",
      );
    }

    // Prevent deletion of certain page types if needed (optional)
    if ($page["page_type"] === "pancake") {
      throw new Exception(
        "Cannot delete Pancake-synced pages. Please remove them from Pancake instead.",
      );
    }

    // First, delete all related records from marketing_user_page table
    $deleteUserPageStmt = $pdo->prepare("
        DELETE FROM marketing_user_page WHERE page_id = ?
    ");
    $deleteUserPageResult = $deleteUserPageStmt->execute([$pageId]);
    $deletedUserRelations = $deleteUserPageStmt->rowCount();

    if (!$deleteUserPageResult) {
      throw new Exception("Failed to delete user-page relationships");
    }

    // Then, delete the page
    $deleteStmt = $pdo->prepare("
        DELETE FROM pages WHERE id = ?
    ");
    $result = $deleteStmt->execute([$pageId]);

    if (!$result) {
      throw new Exception("Failed to delete page");
    }

    // Commit transaction
    $pdo->commit();

    json_response([
      "success" => true,
      "data" => [
        "deleted_page_id" => $pageId,
        "deleted_page_name" => $page["name"],
        "page_type" => $page["page_type"],
        "deleted_user_relations" => $deletedUserRelations,
      ],
      "message" =>
        "Page '{$page["name"]}' deleted successfully" .
        ($deletedUserRelations > 0
          ? " (removed {$deletedUserRelations} user-page relationships)"
          : ""),
    ]);
  } catch (Exception $e) {
    // Rollback transaction on error
    $pdo->rollBack();
    throw $e;
  }
} catch (Exception $e) {
  error_log("Error in delete_page.php: " . $e->getMessage());
  json_response(
    [
      "success" => false,
      "error" => $e->getMessage(),
      "message" => "Failed to delete page",
    ],
    500,
  );
}
