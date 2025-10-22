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
    $removedCount = 0;
    
    // Collect all page-user relationships from API response
    $apiPageUserRelationships = [];
    
    // Process each page and its users
    foreach ($pages as $pageIndex => $page) {
        $pageId = $page['id'] ?? null;
        $pageName = $page['name'] ?? '';
        $users = $page['users'] ?? [];
        
        if (!$pageId) {
            error_log("Skipping page $pageIndex: missing page id");
            $skippedCount++;
            continue;
        }
        
        // Process each user for this page
        foreach ($users as $userIndex => $user) {
            $userId = $user['user_id'] ?? null;
            $userName = $user['name'] ?? '';
            $userStatus = $user['status'] ?? '';
           
            if (!$userId || !$userName) {
                error_log("Skipping user $userIndex for page $pageId: missing user_id or name");
                $skippedCount++;
                continue;
            }
           
            // Create unique key for this page-user relationship
            $relationshipKey = $pageId . '_' . $userId;
           
            // Only add this relationship once
            if (!isset($apiPageUserRelationships[$relationshipKey])) {
                $apiPageUserRelationships[$relationshipKey] = [
                    'page_id' => $pageId,
                    'page_user_id' => $userId,
                    'page_name' => $pageName,
                    'user_name' => $userName,
                    'status' => $userStatus
                ];
            }
        }
    }
    
    // Get all existing records from database
    $existingRecordsSQL = "SELECT page_id, page_user_id FROM page_list_user";
    $existingRecordsStmt = $pdo->prepare($existingRecordsSQL);
    $existingRecordsStmt->execute();
    $existingRecords = $existingRecordsStmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Create a map of existing records for quick lookup
    $existingRecordsMap = [];
    foreach ($existingRecords as $record) {
        $key = $record['page_id'] . '_' . $record['page_user_id'];
        $existingRecordsMap[$key] = $record;
    }
    
    // Process each page-user relationship from API
    foreach ($apiPageUserRelationships as $relationshipKey => $relationship) {
        try {
            $existsInDB = isset($existingRecordsMap[$relationshipKey]);
            
            if ($existsInDB) {
                // Record exists in database, update it
                $updateSQL = "UPDATE page_list_user SET status = ?, still_in_list = 1, updated_at = CURRENT_TIMESTAMP WHERE page_id = ? AND page_user_id = ?";
                $updateStmt = $pdo->prepare($updateSQL);
                $result = $updateStmt->execute([$relationship['status'], $relationship['page_id'], $relationship['page_user_id']]);
               
                if ($result && $updateStmt->rowCount() > 0) {
                    $updatedCount++;
                    error_log("Successfully updated page-user relationship: page_id={$relationship['page_id']}, page_user_id={$relationship['page_user_id']}, status={$relationship['status']}");
                } else {
                    error_log("No changes needed for page-user relationship: page_id={$relationship['page_id']}, page_user_id={$relationship['page_user_id']}");
                }
            } else {
                // Record doesn't exist, insert a new one
                $insertSQL = "INSERT INTO page_list_user (page_id, page_user_id, status, still_in_list) VALUES (?, ?, ?, 1)";
                $stmt = $pdo->prepare($insertSQL);
                $result = $stmt->execute([$relationship['page_id'], $relationship['page_user_id'], $relationship['status']]);
               
                if ($result && $stmt->rowCount() > 0) {
                    $insertedCount++;
                    error_log("Successfully inserted page-user relationship: page_id={$relationship['page_id']}, page_user_id={$relationship['page_user_id']}, status={$relationship['status']}");
                } else {
                    error_log("Failed to insert page-user relationship: page_id={$relationship['page_id']}, page_user_id={$relationship['page_user_id']}");
                    $errorCount++;
                }
            }
        } catch (Exception $e) {
            error_log("Error processing page-user relationship: " . $e->getMessage());
            $errorCount++;
        }
    }
    
    // Mark records that exist in database but not in API response as still_in_list = 0
    foreach ($existingRecordsMap as $existingKey => $existingRecord) {
        if (!isset($apiPageUserRelationships[$existingKey])) {
            try {
                $updateSQL = "UPDATE page_list_user SET still_in_list = 0, updated_at = CURRENT_TIMESTAMP WHERE page_id = ? AND page_user_id = ?";
                $updateStmt = $pdo->prepare($updateSQL);
                $result = $updateStmt->execute([$existingRecord['page_id'], $existingRecord['page_user_id']]);
               
                if ($result && $updateStmt->rowCount() > 0) {
                    $removedCount++;
                    error_log("Marked page-user relationship as removed: page_id={$existingRecord['page_id']}, page_user_id={$existingRecord['page_user_id']}");
                }
            } catch (Exception $e) {
                error_log("Error marking page-user relationship as removed: " . $e->getMessage());
                $errorCount++;
            }
        }
    }
    
    $pdo->commit();
    
    echo json_encode([
        'ok' => true,
        'inserted' => $insertedCount,
        'updated' => $updatedCount,
        'removed' => $removedCount,
        'skipped' => $skippedCount,
        'errors' => $errorCount,
        'total_relationships' => count($apiPageUserRelationships)
    ]);
    
} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    
    http_response_code(500);
    echo json_encode(['error' => 'SYNC_PAGE_LIST_USER_FAILED', 'message' => $e->getMessage()]);
}
?>