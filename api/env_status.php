<?php
require_once 'config.php';

// Enable CORS
cors();

try {
    // Connect to database
    $pdo = db_connect();

    // Get company_id from request
    $companyId = 1; // Default
    if (isset($_GET['company_id'])) {
        $companyId = intval($_GET['company_id']);
    }

    // Check for both username and password keys
    $usernameKey = 'ONECALL_USERNAME_' . $companyId;
    $passwordKey = 'ONECALL_PASSWORD_' . $companyId;

    // Query both keys
    $stmt = $pdo->prepare("SELECT `key`, `value`, `created_at` FROM env WHERE `key` IN (?, ?) ORDER BY created_at DESC");
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
            $credentials['username'] = $row['value'];
        } elseif ($row['key'] === $passwordKey) {
            $hasPassword = true;
            $lastUpdated = $row['created_at'];
            $credentials['password'] = '***'; // Hide password
        }
    }

    $hasCredentials = $hasUsername && $hasPassword;

    json_response([
        'success' => true,
        'company_id' => $companyId,
        'has_credentials' => $hasCredentials,
        'has_username' => $hasUsername,
        'has_password' => $hasPassword,
        'last_updated' => $lastUpdated,
        'credentials' => $credentials,
        'message' => $hasCredentials ? 'All credentials found' : 'Missing credentials'
    ]);

} catch (Exception $e) {
    error_log('Error in env_status.php: ' . $e->getMessage());
    json_response([
        'success' => false,
        'error' => 'Database operation failed',
        'details' => $e->getMessage()
    ], 500);
}
