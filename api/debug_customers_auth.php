<?php
/**
 * Debug endpoint to trace the exact customers API error
 */
ini_set('display_errors', 1);
ini_set('log_errors', 1);
error_reporting(E_ALL);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . '/config.php';

// Simulate the customers API call
try {
    $pdo = db_connect();
    
    // Get auth header (simulate what handle_customers does)
    $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if (!$auth && function_exists('getallheaders')) {
        $headers = getallheaders();
        $auth = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    }
    
    // Check if token exists
    if (!preg_match('/Bearer\s+(\S+)/', $auth, $matches)) {
        echo json_encode(['step' => 'auth', 'error' => 'No token found', 'auth_header' => substr($auth, 0, 50)]);
        exit;
    }
    $token = $matches[1];
    
    // Get user from token
    $stmt = $pdo->prepare('
        SELECT u.id, u.username, u.role, u.company_id, u.status 
        FROM user_tokens ut
        JOIN users u ON u.id = ut.user_id
        WHERE ut.token = ? AND ut.expires_at > NOW()
    ');
    $stmt->execute([$token]);
    $user = $stmt->fetch();
    
    if (!$user) {
        echo json_encode(['step' => 'auth', 'error' => 'Invalid or expired token']);
        exit;
    }
    
    echo json_encode([
        'step' => 'auth_success',
        'user' => $user,
        'message' => 'Auth passed. Now testing customers query...'
    ]);
    
    // Now try the actual customers query with a small limit
    $companyId = $_GET['companyId'] ?? 1;
    $pageSize = min((int)($_GET['pageSize'] ?? 10), 100); // Cap at 100 for safety
    
    $sql = "SELECT * FROM customers WHERE company_id = ? LIMIT ?";
    $stmt2 = $pdo->prepare($sql);
    $stmt2->execute([$companyId, $pageSize]);
    $customers = $stmt2->fetchAll();
    
    echo "\n" . json_encode([
        'step' => 'customers_query',
        'count' => count($customers),
        'sample' => array_slice(array_map(function($c) {
            return ['id' => $c['customer_id'], 'name' => $c['first_name']];
        }, $customers), 0, 3)
    ]);
    
} catch (Throwable $e) {
    echo json_encode([
        'error' => true,
        'message' => $e->getMessage(),
        'file' => $e->getFile(),
        'line' => $e->getLine(),
        'trace' => explode("\n", $e->getTraceAsString())
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
}
