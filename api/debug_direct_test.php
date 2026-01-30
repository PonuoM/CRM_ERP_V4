<?php
/**
 * Direct test of customers API - returns errors in response
 */
ini_set('display_errors', 1);
ini_set('log_errors', 1);
ini_set('memory_limit', '512M');
set_time_limit(120);
error_reporting(E_ALL);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

// Custom error handler to catch all errors
$errors = [];
set_error_handler(function($errno, $errstr, $errfile, $errline) use (&$errors) {
    $errors[] = [
        'type' => $errno,
        'message' => $errstr,
        'file' => basename($errfile),
        'line' => $errline
    ];
    return true;
});

register_shutdown_function(function() use (&$errors) {
    $lastError = error_get_last();
    if ($lastError && in_array($lastError['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR])) {
        echo json_encode([
            'fatal_error' => true,
            'error' => $lastError,
            'captured_errors' => $GLOBALS['errors'] ?? []
        ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    }
});

$results = ['steps' => []];
$results['start_time'] = date('Y-m-d H:i:s');

try {
    require_once __DIR__ . '/config.php';
    $results['steps'][] = ['name' => 'require_config', 'status' => 'ok'];
    
    $pdo = db_connect();
    $results['steps'][] = ['name' => 'db_connect', 'status' => 'ok'];
    
    // Test auth header
    $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if (!$auth && function_exists('getallheaders')) {
        $headers = getallheaders();
        $auth = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    }
    $results['steps'][] = ['name' => 'auth_header', 'value' => substr($auth, 0, 30) . '...'];
    
    // Test if token is valid
    if (preg_match('/Bearer\s+(\S+)/', $auth, $matches)) {
        $token = $matches[1];
        
        // This is the EXACT query from get_authenticated_user
        $stmt = $pdo->prepare('
            SELECT u.id, u.username, u.role, u.company_id, u.status 
            FROM user_tokens ut
            JOIN users u ON u.id = ut.user_id
            WHERE ut.token = ? AND ut.expires_at > NOW()
        ');
        $stmt->execute([$token]);
        $user = $stmt->fetch();
        
        if ($user) {
            $results['steps'][] = ['name' => 'user_from_token', 'status' => 'ok', 'user' => $user];
        } else {
            $results['steps'][] = ['name' => 'user_from_token', 'status' => 'NOT_FOUND'];
        }
    } else {
        $results['steps'][] = ['name' => 'token_parse', 'status' => 'NO_TOKEN'];
    }
    
    // Test file write
    $testPath = __DIR__ . '/test_write_' . time() . '.txt';
    $writeResult = @file_put_contents($testPath, 'test');
    if ($writeResult !== false) {
        @unlink($testPath);
        $results['steps'][] = ['name' => 'file_write', 'status' => 'ok'];
    } else {
        $results['steps'][] = ['name' => 'file_write', 'status' => 'FAILED', 'error' => error_get_last()];
    }
    
    // Try loading distribution_helper (often required by customers)
    if (file_exists(__DIR__ . '/customer/distribution_helper.php')) {
        require_once __DIR__ . '/customer/distribution_helper.php';
        $results['steps'][] = ['name' => 'distribution_helper', 'status' => 'ok'];
    } else {
        $results['steps'][] = ['name' => 'distribution_helper', 'status' => 'NOT_FOUND'];
    }
    
    $results['success'] = true;
    $results['errors'] = $errors;
    $results['memory_peak'] = memory_get_peak_usage(true) / 1024 / 1024 . ' MB';
    
} catch (Throwable $e) {
    $results['success'] = false;
    $results['exception'] = [
        'message' => $e->getMessage(),
        'file' => basename($e->getFile()),
        'line' => $e->getLine(),
        'trace' => array_slice(explode("\n", $e->getTraceAsString()), 0, 10)
    ];
    $results['errors'] = $errors;
}

echo json_encode($results, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
