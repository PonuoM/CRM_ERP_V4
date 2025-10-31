<?php
require_once __DIR__ . '/../config.php';

cors();

try {
    // Get page ID and active status from JSON input
    $input = json_input();

    if (empty($input['page_id'])) {
        json_response([
            'success' => false,
            'error' => 'Page ID is required'
        ], 400);
    }

    if (!isset($input['active'])) {
        json_response([
            'success' => false,
            'error' => 'Active status is required'
        ], 400);
    }

    // Validate and sanitize input
    $pageId = (int)$input['page_id'];
    $active = (int)$input['active']; // Convert to 0 or 1
    $companyId = !empty($input['company_id']) ? (int)$input['company_id'] : null;

    // Validate active status (must be 0 or 1)
    if ($active !== 0 && $active !== 1) {
        json_response([
            'success' => false,
            'error' => 'Active status must be 0 or 1'
        ], 400);
    }

    // Connect to database
    $pdo = db_connect();

    // Start transaction
    $pdo->beginTransaction();

    try {
        // Check if page exists and belongs to the company (if company_id is provided)
        if ($companyId) {
            $checkStmt = $pdo->prepare("
                SELECT id, name, page_type, active FROM pages
                WHERE id = ? AND company_id = ?
            ");
            $checkStmt->execute([$pageId, $companyId]);
        } else {
            $checkStmt = $pdo->prepare("
                SELECT id, name, page_type, active FROM pages
                WHERE id = ?
            ");
            $checkStmt->execute([$pageId]);
        }

        $page = $checkStmt->fetch();

        if (!$page) {
            throw new Exception('Page not found or you do not have permission to modify it');
        }

        // Check if status is already the same
        if ($page['active'] === $active) {
            throw new Exception('Page status is already ' . ($active ? 'active' : 'inactive'));
        }

        // Update the page status
        $updateStmt = $pdo->prepare("
            UPDATE pages SET active = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ");
        $result = $updateStmt->execute([$active, $pageId]);

        if (!$result) {
            throw new Exception('Failed to update page status');
        }

        // Commit transaction
        $pdo->commit();

        json_response([
            'success' => true,
            'data' => [
                'page_id' => $pageId,
                'page_name' => $page['name'],
                'page_type' => $page['page_type'],
                'previous_status' => $page['active'],
                'new_status' => $active
            ],
            'message' => "Page '{$page['name']}' status updated to " . ($active ? 'active' : 'inactive') . " successfully"
        ]);

    } catch (Exception $e) {
        // Rollback transaction on error
        $pdo->rollBack();
        throw $e;
    }

} catch (Exception $e) {
    error_log("Error in toggle_page_status.php: " . $e->getMessage());
    json_response([
        'success' => false,
        'error' => $e->getMessage(),
        'message' => 'Failed to update page status'
    ], 500);
}
