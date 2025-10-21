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
    
    // Query to get users with role = 'Admin Page'
    $stmt = $pdo->prepare('SELECT id, first_name, last_name, email, phone, role FROM users WHERE role = ? OR role LIKE ?');
    $stmt->execute(['Admin Page', '%Admin Page%']);
    $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Format the response
    $formattedUsers = array_map(function($user) {
        return [
            'id' => (int)$user['id'],
            'first_name' => $user['first_name'],
            'last_name' => $user['last_name'],
            'email' => $user['email'],
            'phone' => $user['phone'],
            'role' => $user['role']
        ];
    }, $users);
    
    echo json_encode($formattedUsers);
    
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'GET_ADMIN_USERS_FAILED', 'message' => $e->getMessage()]);
}
?>