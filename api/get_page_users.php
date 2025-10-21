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
    
    // Query to get all page_user records
    $stmt = $pdo->prepare('SELECT id, user_id, page_user_id, page_user_name, page_count, created_at, updated_at FROM page_user ORDER BY page_user_name');
    $stmt->execute();
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