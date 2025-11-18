<?php
// Enable error reporting for debugging
error_reporting(E_ALL);
ini_set("display_errors", 1);

require_once __DIR__ . '/../config.php';

// CORS headers
cors();

// Only allow GET
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
}

try {
    $pdo = db_connect();
} catch (Throwable $e) {
    json_response(['ok' => false, 'error' => 'DB_CONNECT_FAILED', 'message' => $e->getMessage()], 500);
}

// Params: month=YYYY-MM, optional userId, companyId
$month = isset($_GET['month']) ? (string)$_GET['month'] : null;
$userId = isset($_GET['userId']) ? (int)$_GET['userId'] : null;
$companyId = isset($_GET['companyId']) ? (int)$_GET['companyId'] : null;

$sql = 'SELECT * FROM v_telesale_call_overview_monthly WHERE 1';
$params = [];
if (!empty($month)) { $sql .= ' AND month_key = ?'; $params[] = $month; }
if (!empty($userId)) { $sql .= ' AND user_id = ?'; $params[] = $userId; }
if (!empty($companyId)) { $sql .= ' AND user_id IN (SELECT id FROM users WHERE company_id = ?)'; $params[] = $companyId; }
$sql .= ' ORDER BY month_key DESC, user_id';

try {
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    json_response($stmt->fetchAll());
} catch (Throwable $e) {
    json_response(['error' => 'QUERY_FAILED', 'message' => $e->getMessage()], 500);
}

?>

