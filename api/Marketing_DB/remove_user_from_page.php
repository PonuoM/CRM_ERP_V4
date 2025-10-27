<?php
require_once __DIR__ . '/../config.php';

cors();

try {
    $pdo = db_connect();

    // Get input data
    $input = json_input();
    $userId = $input['userId'] ?? null;

    // Additional support for removing specific user-page relationship
    $pageId = $input['pageId'] ?? null;

    // Debug logging
    error_log("remove_user_from_page: userId=" . $userId . ", pageId=" . ($pageId ?? 'null'));

    // Validate input
    if (!$userId) {
        json_response([
            'success' => false,
            'error' => 'Missing required parameter: userId'
        ], 400);
    }

    // If pageId is provided, remove specific relationship
    if ($pageId) {
        // Check if relationship exists
        $existingCheck = $pdo->prepare("SELECT id FROM marketing_user_page WHERE page_id = ? AND user_id = ?");
        $existingCheck->execute([$pageId, $userId]);
        $existing = $existingCheck->fetch();

        error_log("Relationship exists: " . ($existing ? 'yes' : 'no'));

        if (!$existing) {
            json_response([
                'success' => false,
                'error' => 'User-page relationship not found'
            ], 404);
        }

        // Delete specific relationship
        $deleteStmt = $pdo->prepare("DELETE FROM marketing_user_page WHERE page_id = ? AND user_id = ?");
        $deleteStmt->execute([$pageId, $userId]);

        json_response([
            'success' => true,
            'message' => 'User removed from page successfully',
            'data' => [
                'page_id' => $pageId,
                'user_id' => $userId,
                'deleted_id' => $existing['id']
            ]
        ]);
    } else {
        // Remove user from all pages
        $deleteStmt = $pdo->prepare("DELETE FROM marketing_user_page WHERE user_id = ?");
        $deleteStmt->execute([$userId]);

        $affectedRows = $deleteStmt->rowCount();

        json_response([
            'success' => true,
            'message' => 'User removed from all pages successfully',
            'data' => [
                'user_id' => $userId,
                'affected_rows' => $affectedRows
            ]
        ]);
    }

} catch (Exception $e) {
    error_log("Error in remove_user_from_page.php: " . $e->getMessage());
    json_response([
        'success' => false,
        'error' => $e->getMessage(),
        'message' => 'Failed to remove user from page'
    ], 500);
}
