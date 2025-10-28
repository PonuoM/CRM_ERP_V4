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

    // Query to get all pages and mark which ones user has access to
    $stmt = $pdo->prepare("
        SELECT
            p.id,
            p.name,
            p.platform,
            p.url,
            p.active,
            p.still_in_list,
            CASE
                WHEN mup.user_id IS NOT NULL THEN 1
                ELSE 0
            END as has_access,
            mup.created_at as assigned_at
        FROM pages p
        LEFT JOIN marketing_user_page mup ON p.id = mup.page_id AND mup.user_id = ?
        WHERE p.still_in_list = 1
        ORDER BY p.name ASC
    ");

    $stmt->execute([$userId]);
    $pages = $stmt->fetchAll();

    // Filter to only include pages user has access to for filter purposes
    $accessiblePages = array_filter($pages, function($page) {
        return $page['has_access'] == 1;
    });

    json_response([
        'success' => true,
        'data' => [
            'all_pages' => $pages,
            'accessible_pages' => array_values($accessiblePages)
        ],
        'count' => count($accessiblePages)
    ]);

} catch (Exception $e) {
    error_log("Error in get_pages_with_user_access.php: " . $e->getMessage());
    json_response([
        'success' => false,
        'error' => $e->getMessage(),
        'message' => 'Failed to fetch pages with user access'
    ], 500);
}
