<?php
/**
 * Simulate the actual customers API call step by step
 * Call this via AJAX from the browser (so it has the auth cookie/token)
 */
ini_set('display_errors', 1);
ini_set('memory_limit', '512M');
set_time_limit(120);
error_reporting(E_ALL);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$steps = [];
$errors = [];

set_error_handler(function($errno, $errstr, $errfile, $errline) use (&$errors) {
    $errors[] = ['type' => $errno, 'msg' => $errstr, 'file' => basename($errfile), 'line' => $errline];
    return true;
});

try {
    require_once __DIR__ . '/config.php';
    $steps[] = ['config', 'ok'];
    
    $pdo = db_connect();
    $steps[] = ['db', 'ok'];
    
    // Get authenticated user - same as handle_customers does
    $user = get_authenticated_user($pdo);
    if ($user) {
        $steps[] = ['auth', 'ok', $user];
    } else {
        $steps[] = ['auth', 'FAIL - No user'];
        echo json_encode(['steps' => $steps, 'errors' => $errors]);
        exit;
    }
    
    $authCompanyId = $user['company_id'];
    $isSuperAdmin = ($user['role'] === 'SuperAdmin');
    $steps[] = ['role_check', $isSuperAdmin ? 'SuperAdmin' : 'Normal'];
    
    // Now try the actual customers list query (simplified)
    $companyId = $_GET['companyId'] ?? $authCompanyId;
    $pageSize = min((int)($_GET['pageSize'] ?? 50), 100);
    
    // Check if GET params are being read
    $steps[] = ['params', ['companyId' => $companyId, 'pageSize' => $pageSize]];
    
    // Simple customers query
    $sql = "SELECT customer_id, first_name, last_name, phone FROM customers WHERE company_id = ? LIMIT ?";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$companyId, $pageSize]);
    $customers = $stmt->fetchAll();
    $steps[] = ['customers_fetch', count($customers) . ' records'];
    
    // Try tags batch (often problematic)
    if (!empty($customers)) {
        $customerIds = array_column($customers, 'customer_id');
        $placeholders = implode(',', array_fill(0, count($customerIds), '?'));
        
        $tagsSql = "SELECT ct.customer_id, t.id, t.name FROM customer_tags ct JOIN tags t ON t.id = ct.tag_id WHERE ct.customer_id IN ($placeholders)";
        $tagsStmt = $pdo->prepare($tagsSql);
        $tagsStmt->execute($customerIds);
        $tagsCount = count($tagsStmt->fetchAll());
        $steps[] = ['tags_batch', $tagsCount . ' tags'];
    }
    
    // Try next appointments 
    if (!empty($customers)) {
        $placeholders = implode(',', array_fill(0, count($customerIds), '?'));
        $aptSql = "SELECT customer_id, id, date, title FROM appointments WHERE customer_id IN ($placeholders) AND status != 'เสร็จสิ้น' AND date >= CURDATE() LIMIT 100";
        $aptStmt = $pdo->prepare($aptSql);
        $aptStmt->execute($customerIds);
        $aptCount = count($aptStmt->fetchAll());
        $steps[] = ['appointments_batch', $aptCount . ' appointments'];
    }
    
    $steps[] = ['COMPLETE', 'All passed!'];
    
} catch (Throwable $e) {
    $steps[] = ['EXCEPTION', $e->getMessage(), basename($e->getFile()) . ':' . $e->getLine()];
}

echo json_encode([
    'steps' => $steps,
    'errors' => $errors,
    'memory' => memory_get_peak_usage(true) / 1024 / 1024 . ' MB'
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
