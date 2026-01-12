<?php
require_once __DIR__ . '/config.php';

// Enable CORS
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Only allow GET requests
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

try {
    // Connect to database
    $pdo = db_connect();

    // Authenticate
    validate_auth($pdo);
    $user = get_authenticated_user($pdo);
    if (!$user) {
        http_response_code(401);
        echo json_encode(['error' => 'UNAUTHORIZED']);
        exit;
    }

    // DEBUG: Log user and company ID
    error_log("[get_page_users] User ID: {$user['id']}, Company ID: {$user['company_id']}");
    
    // Query to get page_user records associated with company pages
    // We join page_user -> page_list_user -> pages to filter by company_id
    $sql = "SELECT DISTINCT pu.id, pu.user_id, pu.page_user_id, pu.page_user_name, pu.page_count, pu.created_at, pu.updated_at 
            FROM page_user pu
            JOIN page_list_user plu ON pu.page_user_id COLLATE utf8mb4_unicode_ci = plu.page_user_id COLLATE utf8mb4_unicode_ci
            JOIN pages p ON plu.page_id COLLATE utf8mb4_unicode_ci = p.page_id COLLATE utf8mb4_unicode_ci
            WHERE p.company_id = ?
            ORDER BY pu.page_user_name";
            
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$user['company_id']]);
    $pageUsers = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Format the response
    $formattedPageUsers = array_map(function($pageUser) {
        return [
            'id' => (int)$pageUser['id'],
            'user_id' => $pageUser['user_id'] ? (int)$pageUser['user_id'] : null,
            'page_user_id' => $pageUser['page_user_id'],
            'page_user_name' => $pageUser['page_user_name'],
            'page_count' => (int)$pageUser['page_count'],
            'created_at' => $pageUser['created_at'],
            'updated_at' => $pageUser['updated_at']
        ];
    }, $pageUsers);
    
    echo json_encode($formattedPageUsers);
    
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'GET_PAGE_USERS_FAILED', 'message' => $e->getMessage()]);
}
?>