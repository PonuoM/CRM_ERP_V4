<?php
require_once __DIR__ . '/../config.php';

cors();

try {
    $pdo = db_connect();

    // Query to get all marketing users connected to pages with user details
    $stmt = $pdo->prepare("
        SELECT
            mup.id,
            mup.page_id,
            mup.user_id,
            mup.created_at,
            mup.updated_at,
            u.first_name,
            u.last_name,
            u.username,
            u.email
        FROM marketing_user_page mup
        INNER JOIN users u ON mup.user_id = u.id
        INNER JOIN pages p ON mup.page_id = p.id
        WHERE u.role = 'Marketing'
        ORDER BY mup.page_id, u.first_name, u.last_name
    ");

    $stmt->execute();
    $users = $stmt->fetchAll();

    json_response([
        'success' => true,
        'data' => $users,
        'count' => count($users)
    ]);

} catch (Exception $e) {
    error_log("Error in get_marketing_page_users.php: " . $e->getMessage());
    json_response([
        'success' => false,
        'error' => $e->getMessage(),
        'message' => 'Failed to fetch marketing page users'
    ], 500);
}
