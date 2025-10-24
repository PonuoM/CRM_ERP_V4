<?php
require_once __DIR__ . '/../config.php';

cors();

try {
    $pdo = db_connect();

    // Get input data
    $input = json_input();
    $pageId = $input['pageId'] ?? null;
    $userId = $input['userId'] ?? null;

    // Validate input
    if (!$pageId || !$userId) {
        json_response([
            'success' => false,
            'error' => 'Missing required parameters: pageId and userId'
        ], 400);
    }

    // Check if user exists and is Marketing role
    $userCheck = $pdo->prepare("SELECT id, role FROM users WHERE id = ? AND role = 'Marketing'");
    $userCheck->execute([$userId]);
    $user = $userCheck->fetch();

    if (!$user) {
        json_response([
            'success' => false,
            'error' => 'User not found or not a Marketing user'
        ], 404);
    }

    // Check if page exists and is active
    $pageCheck = $pdo->prepare("SELECT id FROM pages WHERE id = ? AND still_in_list = 1");
    $pageCheck->execute([$pageId]);
    $page = $pageCheck->fetch();

    if (!$page) {
        json_response([
            'success' => false,
            'error' => 'Page not found or not active'
        ], 404);
    }

    // Check if relationship already exists
    $existingCheck = $pdo->prepare("SELECT id FROM marketing_user_page WHERE page_id = ? AND user_id = ?");
    $existingCheck->execute([$pageId, $userId]);

    if ($existingCheck->fetch()) {
        json_response([
            'success' => false,
            'error' => 'User is already connected to this page'
        ], 409);
    }

    // Insert new relationship
    $insertStmt = $pdo->prepare("
        INSERT INTO marketing_user_page (page_id, user_id)
        VALUES (?, ?)
    ");

    $insertStmt->execute([$pageId, $userId]);

    json_response([
        'success' => true,
        'message' => 'User added to page successfully',
        'data' => [
            'id' => $pdo->lastInsertId(),
            'page_id' => $pageId,
            'user_id' => $userId
        ]
    ]);

} catch (Exception $e) {
    error_log("Error in add_user_to_page.php: " . $e->getMessage());
    json_response([
        'success' => false,
        'error' => $e->getMessage(),
        'message' => 'Failed to add user to page'
    ], 500);
}
