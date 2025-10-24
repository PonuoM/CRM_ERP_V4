<?php
require_once '../config.php';

// Enable CORS
cors();

// Get request method
$method = $_SERVER['REQUEST_METHOD'];

// Rate limiting
$client_ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$rate_key = "env_manager_rate_" . md5($client_ip);
$rate_file = sys_get_temp_dir() . "/" . $rate_key;

// Rate limiting: max 20 requests per minute for combined API
if (file_exists($rate_file)) {
    $requests = json_decode(file_get_contents($rate_file), true) ?: [];
    $now = time();
    $requests = array_filter($requests, function($timestamp) use ($now) {
        return $now - $timestamp < 60;
    });

    if (count($requests) >= 20) {
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
    // Get user data from request (simpler approach)
    $user = null;
    $input = json_decode(file_get_contents('php://input'), true);

    // Try to get user data from POST body
    if (isset($input['user'])) {
        $user = $input['user'];
    }

    // Fallback: Get from GET parameters for status check
    if (!$user && $method === 'GET') {
        if (isset($_GET['user_id']) && isset($_GET['company_id']) && isset($_GET['role'])) {
            $user = [
                'id' => intval($_GET['user_id']),
                'company_id' => intval($_GET['company_id']),
                'role' => $_GET['role']
            ];
        }
    }

    // Fallback: Use default company if no user data (for testing)
    if (!$user) {
        $user = [
            'id' => 1,
            'company_id' => 1,
            'role' => 'Super Admin'
        ];
    }

    // Connect to database
    $pdo = db_connect();

    if ($method === 'GET') {
            // Handle status check
            handleStatusCheck($pdo, $user, $input);
        } elseif ($method === 'POST') {
            // Handle insert/update operations or status check via POST
            if (isset($input['action']) && $input['action'] === 'check_status') {
                handleStatusCheck($pdo, $user, $input);
            } else {
                handleInsertUpdate($pdo, $user, $input);
            }
        } else {
            json_response(['error' => 'Method not allowed'], 405);
        }

} catch (Exception $e) {
    error_log('Error in env_manager.php: ' . $e->getMessage());
    json_response([
        'error' => 'Database operation failed',
        'details' => $e->getMessage()
    ], 500);
}

function handleStatusCheck($pdo, $user, $input) {
    // Get company_id from input or user data
    $companyId = intval($user['company_id']);

    // Override with input company_id if provided
    if (isset($input['company_id']) && is_numeric($input['company_id'])) {
        $companyId = intval($input['company_id']);
    }

    // Override with request parameter if provided and user is admin
    if (isset($_GET['company_id']) && is_numeric($_GET['company_id'])) {
        $requestedCompanyId = intval($_GET['company_id']);

        // Only allow if user is admin or requesting their own company
        if ($user['role'] === 'Super Admin' || $user['role'] === 'AdminControl' || $requestedCompanyId === $companyId) {
            $companyId = $requestedCompanyId;
        }
    }

    // Check for both username and password keys
    $usernameKey = 'ONECALL_USERNAME_' . $companyId;
    $passwordKey = 'ONECALL_PASSWORD_' . $companyId;

    // Query both keys
    $stmt = $pdo->prepare("SELECT `key`, `value`, `created_at` FROM env WHERE `key` IN (?, ?) ORDER BY created_at DESC LIMIT 2");
    $stmt->execute([$usernameKey, $passwordKey]);
    $results = $stmt->fetchAll();

    // Check if we have both credentials
    $hasUsername = false;
    $hasPassword = false;
    $lastUpdated = null;
    $credentials = [];

    foreach ($results as $row) {
        if ($row['key'] === $usernameKey) {
            $hasUsername = true;
            $lastUpdated = $row['created_at'];
            $credentials['username'] = substr($row['value'], 0, 3) . '***' . substr($row['value'], -2);
        } elseif ($row['key'] === $passwordKey) {
            $hasPassword = true;
            $lastUpdated = $row['created_at'];
            $credentials['password'] = '***';
        }
    }

    $hasCredentials = $hasUsername && $hasPassword;

    json_response([
        'success' => true,
        'action' => 'status_check',
        'company_id' => $companyId,
        'has_credentials' => $hasCredentials,
        'has_username' => $hasUsername,
        'has_password' => $hasPassword,
        'last_updated' => $lastUpdated,
        'credentials' => $credentials,
        'message' => $hasCredentials ? 'All credentials found' : 'Missing credentials',
        'user_info' => $user
    ]);
}

function handleInsertUpdate($pdo, $user, $input) {
    // Get environment data to insert
    if (!isset($input['key']) || !isset($input['value'])) {
        json_response(['error' => 'Missing required fields: key and value'], 400);
    }

    $key = trim($input['key']);
    $value = trim($input['value']);

    if (empty($key) || empty($value)) {
        json_response(['error' => 'Key and value cannot be empty'], 400);
    }

    // Security: Validate key format (only allow ONECALL_ keys)
    if (!preg_match('/^ONECALL_(USERNAME|PASSWORD)_\d+$/', $key)) {
        json_response(['error' => 'Invalid key format. Only ONECALL keys are allowed'], 400);
    }

    // Security: Extract company ID from key and validate access
    $companyIdFromKey = intval(preg_replace('/^ONECALL_(USERNAME|PASSWORD)_(\d+)$/', '$2', $key));
    $userCompanyId = intval($user['company_id']);

    // Only allow if user is admin or modifying their own company
    if ($user['role'] !== 'Super Admin' && $user['role'] !== 'AdminControl' && $companyIdFromKey !== $userCompanyId) {
        json_response(['error' => 'Forbidden - Cannot modify other company credentials'], 403);
    }

    // Security: Limit value length
    if (strlen($value) > 255) {
        json_response(['error' => 'Value too long. Maximum 255 characters allowed'], 400);
    }

    // Check if key already exists
    $stmt = $pdo->prepare("SELECT id FROM env WHERE `key` = ?");
    $stmt->execute([$key]);
    $existing = $stmt->fetch();

    $current_time = date('Y-m-d H:i:s');

    if ($existing) {
        // Update existing record
        $stmt = $pdo->prepare("UPDATE env SET `value` = ?, created_at = ? WHERE `key` = ?");
        $stmt->execute([$value, $current_time, $key]);

        json_response([
            'success' => true,
            'action' => 'update',
            'key' => $key,
            'updated_at' => $current_time,
            'message' => 'Environment variable updated successfully',
            'user_info' => $user
        ]);
    } else {
        // Insert new record
        $stmt = $pdo->prepare("INSERT INTO env (`id`, `key`, `value`, `created_at`) VALUES (NULL, ?, ?, ?)");
        $stmt->execute([$key, $value, $current_time]);

        $inserted_id = $pdo->lastInsertId();

        json_response([
            'success' => true,
            'action' => 'insert',
            'id' => $inserted_id,
            'key' => $key,
            'created_at' => $current_time,
            'message' => 'Environment variable inserted successfully',
            'user_info' => $user
        ]);
    }
}
