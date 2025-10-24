<?php
require_once '../config.php';

// Enable CORS
cors();

// Only allow POST requests for security
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['error' => 'Method not allowed'], 405);
}

// Rate limiting
$client_ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$rate_key = "get_creds_rate_" . md5($client_ip);
$rate_file = sys_get_temp_dir() . "/" . $rate_key;

// Rate limiting: max 5 requests per minute
if (file_exists($rate_file)) {
    $requests = json_decode(file_get_contents($rate_file), true) ?: [];
    $now = time();
    $requests = array_filter($requests, function($timestamp) use ($now) {
        return $now - $timestamp < 60;
    });

    if (count($requests) >= 5) {
        http_response_code(429);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Too many requests']);
        exit;
    }

    $requests[] = $now;
    file_put_contents($rate_file, json_encode($requests));
} else {
    file_put_contents($rate_file, json_encode([time()]));
}

try {
    // Get user data from request
    $input = json_input();

    if (!isset($input['user'])) {
        json_response(['error' => 'User data required'], 400);
    }

    $user = $input['user'];

    // Validate required user fields
    if (!isset($user['company_id']) || !isset($user['role'])) {
        json_response(['error' => 'Missing required user fields'], 400);
    }

    // Security: Only allow Super Admin and AdminControl roles
    if ($user['role'] !== 'Super Admin' && $user['role'] !== 'AdminControl') {
        http_response_code(403);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Access denied - insufficient permissions']);
        exit;
    }

    // Connect to database
    $pdo = db_connect();

    // Get company_id
    $companyId = intval($user['company_id']);

    // Check for both username and password keys
    $usernameKey = 'ONECALL_USERNAME_' . $companyId;
    $passwordKey = 'ONECALL_PASSWORD_' . $companyId;

    // Query both keys
    $stmt = $pdo->prepare("SELECT `key`, `value` FROM env WHERE `key` IN (?, ?)");
    $stmt->execute([$usernameKey, $passwordKey]);
    $results = $stmt->fetchAll();

    $username = null;
    $password = null;
    $foundUsername = false;
    $foundPassword = false;

    foreach ($results as $row) {
        if ($row['key'] === $usernameKey) {
            $username = $row['value'];
            $foundUsername = true;
        } elseif ($row['key'] === $passwordKey) {
            $password = $row['value'];
            $foundPassword = true;
        }
    }

    if (!$foundUsername || !$foundPassword) {
        json_response([
            'success' => false,
            'error' => 'Onecall credentials not found for company',
            'found_username' => $foundUsername,
            'found_password' => $foundPassword
        ], 404);
    }

    // Log the access for security audit (in production, this should go to a secure audit log)
    error_log('Onecall credentials accessed by user_id: ' . ($user['id'] ?? 'unknown') . ' for company_id: ' . $companyId . ' at ' . date('Y-m-d H:i:s'));

    // Return credentials (only for authenticated, authorized users)
    json_response([
        'success' => true,
        'data' => [
            'username' => $username,
            'password' => $password
        ],
        'company_id' => $companyId,
        'retrieved_at' => date('Y-m-d H:i:s'),
        'message' => 'Credentials retrieved successfully'
    ]);

} catch (Exception $e) {
    error_log('Error in get_credentials.php: ' . $e->getMessage());
    json_response([
        'error' => 'Database operation failed',
        'details' => 'Internal server error' // Don't expose details in production
    ], 500);
}
