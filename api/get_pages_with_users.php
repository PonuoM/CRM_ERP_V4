<?php
// Enable error reporting for debugging
error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once __DIR__ . '/config.php';

// Enable CORS
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

try {
    // Connect to database
    $pdo = db_connect();
    
    // Get JSON input
    $input = json_decode(file_get_contents('php://input'), true);
    
    $companyId = $input['companyId'] ?? null;
    
    if (!$companyId) {
        http_response_code(400);
        echo json_encode(['error' => 'companyId is required', 'input' => $input]);
        exit;
    }
    
    // Debug: Log the company ID
    error_log("Company ID: " . $companyId);
    
    // Check if pages table exists and has the expected structure
    $tableCheck = $pdo->query("DESCRIBE pages");
    $columns = [];
    foreach ($tableCheck as $column) {
        $columns[] = $column['Field'];
    }
    
    error_log("Pages table columns: " . implode(', ', $columns));
    
    // Check if required columns exist
    $requiredColumns = ['page_id', 'name', 'platform', 'active', 'url', 'still_in_list', 'company_id'];
    $missingColumns = array_diff($requiredColumns, $columns);
    
    if (!empty($missingColumns)) {
        error_log("Missing columns in pages table: " . implode(', ', $missingColumns));
        http_response_code(500);
        echo json_encode(['error' => 'Database structure issue', 'missing_columns' => array_values($missingColumns)]);
        exit;
    }
    
    // Check if page_list_user table exists
    try {
        $pdo->query("SELECT 1 FROM page_list_user LIMIT 1");
    } catch (Exception $e) {
        error_log("page_list_user table does not exist: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'page_list_user table does not exist']);
        exit;
    }
    
    // Check if page_user table exists
    try {
        $pdo->query("SELECT 1 FROM page_user LIMIT 1");
    } catch (Exception $e) {
        error_log("page_user table does not exist: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'page_user table does not exist']);
        exit;
    }
    
    // Get all pages with their users for the specific company
    $stmt = $pdo->prepare('
        SELECT
            p.page_id,
            p.name as page_name,
            p.platform,
            p.active,
            p.url,
            pu.page_user_id,
            pu.page_user_name,
            pu.user_id as internal_user_id,
            CASE WHEN pu.user_id IS NOT NULL THEN 1 ELSE 0 END as is_connected,
            COALESCE(plu.status, "unknown") as status
        FROM pages p
        LEFT JOIN page_list_user plu ON p.page_id COLLATE utf8mb4_unicode_ci = plu.page_id COLLATE utf8mb4_unicode_ci
        LEFT JOIN page_user pu ON plu.page_user_id COLLATE utf8mb4_unicode_ci = pu.page_user_id COLLATE utf8mb4_unicode_ci
        WHERE p.still_in_list = 1 AND p.company_id = ?
        ORDER BY p.name COLLATE utf8mb4_unicode_ci, pu.page_user_name COLLATE utf8mb4_unicode_ci
    ');
    
    $stmt->execute([$companyId]);
    $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    error_log("Query returned " . count($results) . " results");
    
    // Group by page
    $pages = [];
    foreach ($results as $row) {
        $pageId = $row['page_id'];
        
        if (!isset($pages[$pageId])) {
            $pages[$pageId] = [
                'page_id' => $row['page_id'],
                'page_name' => $row['page_name'],
                'platform' => $row['platform'],
                'active' => (bool)$row['active'],
                'url' => $row['url'],
                'users' => []
            ];
        }
        
        // Add user to this page if user exists
        if ($row['page_user_id']) {
            $pages[$pageId]['users'][] = [
                'page_user_id' => $row['page_user_id'],
                'page_user_name' => $row['page_user_name'],
                'internal_user_id' => $row['internal_user_id'],
                'is_connected' => (bool)$row['is_connected'],
                'status' => $row['status']
            ];
        }
    }
    
    // Convert to indexed array
    $result = array_values($pages);
    
    echo json_encode($result);
    
} catch (Throwable $e) {
    error_log("Error in get_pages_with_users: " . $e->getMessage());
    error_log("Stack trace: " . $e->getTraceAsString());
    http_response_code(500);
    echo json_encode([
        'error' => 'GET_PAGES_WITH_USERS_FAILED',
        'message' => $e->getMessage(),
        'file' => $e->getFile(),
        'line' => $e->getLine()
    ]);
}
?>