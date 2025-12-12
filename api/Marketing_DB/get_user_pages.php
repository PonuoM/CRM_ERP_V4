<?php
require_once __DIR__ . '/../config.php';

cors();

try {
    $pdo = db_connect();

    // Get input data
    $input = json_input();
    $userId = $input['userId'] ?? null;

    // Validate input
    if (!$userId) {
        json_response([
            'success' => false,
            'error' => 'Missing required parameter: userId'
        ], 400);
    }

    // Query to get pages that user has access to from marketing_user_page table
    $stmt = $pdo->prepare("
        SELECT
            p.id,
            p.name,
            p.platform,
            p.url,
            p.active,
            mup.created_at as assigned_at
        FROM pages p
        INNER JOIN marketing_user_page mup ON p.id = mup.page_id
        WHERE mup.user_id = ? AND p.still_in_list = 1 AND p.active = 1
        ORDER BY p.name ASC
    ");

    $stmt->execute([$userId]);
    $pages = $stmt->fetchAll();

    json_response([
        'success' => true,
        'data' => $pages,
        'count' => count($pages)
    ]);

} catch (Exception $e) {
    error_log("Error in get_user_pages.php: " . $e->getMessage());
    json_response([
        'success' => false,
        'error' => $e->getMessage(),
        'message' => 'Failed to fetch user pages'
    ], 500);
}
