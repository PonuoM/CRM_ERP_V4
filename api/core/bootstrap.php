<?php

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../Services/ShippingSyncService.php';
require_once __DIR__ . '/../Services/BasketRoutingService.php';
require_once __DIR__ . '/../Quota/quota_record_helper.php';
require_once __DIR__ . '/../Services/CustomerStatsHelper.php';

// API Version for debugging deployment issues
define('API_VERSION', '2026-01-24-0947-BASKET-FIX');

// Polyfill for PHP < 8 str_starts_with
if (!function_exists('str_starts_with')) {
    function str_starts_with(string $haystack, string $needle): bool
    {
        return $needle !== '' && strpos($haystack, $needle) === 0 || ($needle === '' && true);
    }
}

cors();

// Helper to log performance
function log_perf($msg, $startTime = null)
{
    if ($startTime) {
        $duration = microtime(true) - $startTime;
        $msg .= " (" . round($duration * 1000, 2) . "ms)";
    }
    // error_log("[PERF] " . $msg); // Uncomment to enable perf logging
}

/**
 * Resolves an arbitrary string into a valid parent order ID and box number.
 * Fixes Foreign Key issues caused by naive regex matching on order IDs that contain hyphens.
 *
 * @param PDO $pdo
 * @param string $id The input string (e.g., 'ORD-20240101-001', 'ORD-001-1', '260616-1')
 * @return array ['is_sub' => bool, 'main_id' => string, 'box_number' => int, 'found' => bool]
 */
function resolve_main_order_id(PDO $pdo, string $id): array {
    // 1. Exact match for a parent order ID
    $stmt = $pdo->prepare("SELECT id FROM orders WHERE id = ? LIMIT 1");
    $stmt->execute([$id]);
    if ($stmt->fetch()) {
        return ['is_sub' => false, 'main_id' => $id, 'box_number' => 1, 'found' => true];
    }
    
    // 2. Check if it's a sub_order_id in order_boxes
    $boxStmt = $pdo->prepare("SELECT order_id, box_number FROM order_boxes WHERE sub_order_id = ? LIMIT 1");
    $boxStmt->execute([$id]);
    if ($boxInfo = $boxStmt->fetch(PDO::FETCH_ASSOC)) {
        return ['is_sub' => true, 'main_id' => $boxInfo['order_id'], 'box_number' => (int)$boxInfo['box_number'], 'found' => true];
    }
    
    // 3. Fallback: Parse suffix ONLY IF the stripped prefix exists as a parent order
    if (preg_match('/^(.+)-(\d+)$/', $id, $matches)) {
        $potentialParent = $matches[1];
        $boxNum = (int)$matches[2];
        
        $stmt->execute([$potentialParent]);
        if ($stmt->fetch()) {
            return ['is_sub' => true, 'main_id' => $potentialParent, 'box_number' => $boxNum, 'found' => true];
        }
    }
    
    // 4. Default fallback
    return ['is_sub' => false, 'main_id' => $id, 'box_number' => 1, 'found' => false];
}
function route_path(): array
{
    $uri = $_SERVER['REQUEST_URI'] ?? '/';
    $scriptDir = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '')), '/');
    $path = parse_url($uri, PHP_URL_PATH) ?: '/';
    if ($scriptDir && str_starts_with($path, $scriptDir)) {
        $path = substr($path, strlen($scriptDir));
    }
    $path = trim($path, '/');
    // Expecting paths like: api/customers, customers/ID, etc.
    // If this app is mounted at /api, strip that prefix
    if (str_starts_with($path, 'api/')) {
        $path = substr($path, 4);
    } elseif ($path === 'api') {
        $path = '';
    }
    // If path begins with index.php/, strip it (fallback when rewrite not active)
    if (str_starts_with($path, 'index.php/')) {
        $path = substr($path, strlen('index.php/'));
    } elseif ($path === 'index.php') {
        $path = '';
    }
    return explode('/', $path);
}

function method(): string
{
    return $_SERVER['REQUEST_METHOD'] ?? 'GET';
}

try {
    $pdo = db_connect();
} catch (Throwable $e) {
    json_response(['ok' => false, 'error' => 'DB_CONNECT_FAILED', 'message' => $e->getMessage()], 500);
}

$parts = route_path();
$resource = $parts[0] ?? '';
$id = $parts[1] ?? null;
$action = $parts[2] ?? null;

// Set audit context early for tracked resources (orders + customers)
if (in_array($resource, ['orders', 'customers'])) {
    set_audit_context($pdo, 'index/' . $resource . '_' . strtolower(method()));
}

if ($resource === 'notifications' && $action === null && $id !== null) {
    $action = $id;
    $id = null;
}

if ($resource === '' || $resource === 'health') {
    json_response(['ok' => true, 'status' => 'healthy']);
}

// Version check endpoint
if ($resource === 'version') {
    json_response([
        'ok' => true,
        'version' => defined('API_VERSION') ? API_VERSION : 'UNKNOWN',
        'timestamp' => date('Y-m-d H:i:s'),
        'basket_fix' => true
    ]);
}

if (!in_array($resource, ['', 'health', 'auth', 'uploads', 'version', 'cron'])) {
    if ($resource === 'customers') {
        file_put_contents(__DIR__ . '/../debug_check.log', date('Y-m-d H:i:s') . " CUSTOMERS GET: " . json_encode($_GET) . "\n", FILE_APPEND);
    }
    try {
        validate_auth($pdo);
    } catch (Throwable $e) {
        file_put_contents(__DIR__ . '/../auth_error.log', date('Y-m-d H:i:s') . " AUTH EXCEPTION: " . $e->getMessage() . "\n" . $e->getTraceAsString() . "\n", FILE_APPEND);
        json_response(['ok' => false, 'error' => 'AUTH_INTERNAL_ERROR', 'message' => $e->getMessage()], 500);
    }
}
