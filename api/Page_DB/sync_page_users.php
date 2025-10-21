<?php
require_once __DIR__ . '/../config.php';

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
    
    if (!$input) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid JSON input']);
        exit;
    }
    
    $pages = $input['pages'] ?? [];
    $companyId = $input['companyId'] ?? null;
    
    if (empty($pages) || !$companyId) {
        http_response_code(400);
        echo json_encode(['error' => 'pages and companyId are required']);
        exit;
    }
    
    $pdo->beginTransaction();
    
    $insertedCount = 0;
    $updatedCount = 0;
    $skippedCount = 0;
    $errorCount = 0;
    
    // Arrays to store SQL commands
    $insertSQLs = [];
    $updateSQLs = [];
    
    // Array to store error details
    $errorDetails = [];
    
    // Collect all users across all pages to count page occurrences
    $allUsers = [];
    foreach ($pages as $pageIndex => $page) {
        $pageId = $page['id'] ?? null;
        $pageName = $page['name'] ?? '';
        $users = $page['users'] ?? [];
        
        if (!$pageId) {
            error_log("Skipping page $pageIndex: missing page id");
            $skippedCount++;
            continue;
        }
        
        // Collect each user for this page
        foreach ($users as $userIndex => $user) {
            $userId = $user['user_id'] ?? null; // Using user_id as the user identifier
            $userName = $user['name'] ?? '';
            
            if (!$userId || !$userName) {
                error_log("Skipping user $userIndex for page $pageId: missing user_id or name");
                $skippedCount++;
                continue;
            }
            
            // Store user info with page count
            $userKey = $userId;
            if (!isset($allUsers[$userKey])) {
                $allUsers[$userKey] = [
                    'page_user_id' => $userId,
                    'page_user_name' => $userName,
                    'page_count' => 0,
                    'pages' => []
                ];
            }
            
            // Only count this user once per page
            if (!in_array($pageId, $allUsers[$userKey]['pages'])) {
                $allUsers[$userKey]['page_count']++;
                $allUsers[$userKey]['pages'][] = $pageId;
            }
        }
    }
    
    // Get existing page_user records
    $existingUsers = [];
    $existingStmt = $pdo->prepare('SELECT id, page_user_id, page_user_name, page_count FROM page_user');
    $existingStmt->execute();
    $existingResults = $existingStmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($existingResults as $row) {
        $existingUsers[$row['page_user_id']] = $row;
    }
    
    // Process users: update existing or insert new
    foreach ($allUsers as $userInfo) {
        $pageUserId = $userInfo['page_user_id'];
        $pageUserName = $userInfo['page_user_name'];
        $pageCount = $userInfo['page_count'];
        
        try {
            if (isset($existingUsers[$pageUserId])) {
                // Update existing record
                $existingRecord = $existingUsers[$pageUserId];
                $updateSQL = "UPDATE page_user SET page_user_name = ?, page_count = ?, updated_at = CURRENT_TIMESTAMP WHERE page_user_id = ?";
                $updateSQLs[] = $updateSQL . " [VALUES: '{$pageUserName}', {$pageCount}, '{$pageUserId}']";
                
                $stmt = $pdo->prepare($updateSQL);
                $result = $stmt->execute([$pageUserName, $pageCount, $pageUserId]);
                
                if ($result && $stmt->rowCount() > 0) {
                    $updatedCount++;
                    error_log("Successfully updated page user: user_id={$pageUserId}, name={$pageUserName}, page_count={$pageCount}");
                } else {
                    error_log("No changes needed for page user: user_id={$pageUserId}");
                }
            } else {
                // Insert new record
                $insertSQL = "INSERT INTO page_user (page_user_id, page_user_name, page_count) VALUES (?, ?, ?)";
                $insertSQLs[] = $insertSQL . " [VALUES: '{$pageUserId}', '{$pageUserName}', {$pageCount}]";
                
                $stmt = $pdo->prepare($insertSQL);
                $result = $stmt->execute([$pageUserId, $pageUserName, $pageCount]);
                
                if ($result && $stmt->rowCount() > 0) {
                    $insertedCount++;
                    error_log("Successfully inserted page user: user_id={$pageUserId}, name={$pageUserName}, page_count={$pageCount}");
                } else {
                    error_log("Failed to insert page user: user_id={$pageUserId}");
                    $errorCount++;
                }
            }
        } catch (Exception $e) {
            error_log("Error processing page user {$pageUserId}: " . $e->getMessage());
            $errorCount++;
            $errorDetails[] = [
                'userId' => $pageUserId,
                'operation' => isset($existingUsers[$pageUserId]) ? 'update' : 'insert',
                'error' => $e->getMessage()
            ];
        }
    }
    
    $pdo->commit();
    
    echo json_encode([
        'ok' => true,
        'deleted' => 0, // No deletions in new implementation
        'inserted' => $insertedCount,
        'updated' => $updatedCount,
        'skipped' => $skippedCount,
        'errors' => $errorCount,
        'errorDetails' => $errorDetails,
        'insertSQLs' => $insertSQLs,
        'updateSQLs' => $updateSQLs
    ]);
    
} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    
    http_response_code(500);
    echo json_encode(['error' => 'SYNC_PAGE_USERS_FAILED', 'message' => $e->getMessage()]);
}
?>