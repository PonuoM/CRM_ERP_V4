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
    
    // Get existing pages from database
    $existingPages = [];
    $existingStmt = $pdo->prepare('SELECT page_id, still_in_list FROM pages WHERE company_id = ?');
    $existingStmt->execute([$companyId]);
    $existingResults = $existingStmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($existingResults as $row) {
        $existingPages[$row['page_id']] = $row['still_in_list'];
    }
    
    // Generate SQL commands for each page
    foreach ($pages as $index => $page) {
        $pageId = $page['id'] ?? null;
        $name = $page['name'] ?? '';
        $platform = $page['platform'] ?? '';
        $isActive = isset($page['is_activated']) ? ($page['is_activated'] ? 1 : 0) : 0;
        $category = $page['category'] ?? '';
        
        // Determine still_in_list based on category
        // If category is 'activated', still_in_list = 1, otherwise 0
        $stillInList = ($category === 'activated') ? 1 : 0;
        
        // Log the page data for debugging
        error_log("Processing page $index: " . json_encode($page));
        
        if (!$pageId || !$name) {
            error_log("Skipping page $index: missing id or name");
            $skippedCount++;
            continue;
        }
        
        // Check if page exists in database
        $pageExists = isset($existingPages[$pageId]);
        $currentStillInList = $pageExists ? $existingPages[$pageId] : 1;
        
        if ($pageExists) {
            // Generate UPDATE SQL using prepared statement
            $updateSQL = "UPDATE pages SET name = ?, platform = ?, active = ?, still_in_list = ? WHERE page_id = ? AND company_id = ?";
            $updateSQLs[] = $updateSQL . " [VALUES: '{$name}', '{$platform}', {$isActive}, {$stillInList}, '{$pageId}', {$companyId}]";
            
            try {
                $stmt = $pdo->prepare($updateSQL);
                $result = $stmt->execute([$name, $platform, $isActive, $stillInList, $pageId, $companyId]);
                
                if ($result) {
                    if ($stmt->rowCount() > 0) {
                        $updatedCount++;
                        error_log("Successfully updated page: $pageId, still_in_list: {$stillInList}");
                    } else {
                        error_log("No changes needed for page: $pageId");
                    }
                } else {
                    error_log("Failed to update page: $pageId");
                    $errorCount++;
                }
            } catch (Exception $e) {
                error_log("Error updating page $pageId: " . $e->getMessage());
                $errorCount++;
                $errorDetails[] = [
                    'pageId' => $pageId,
                    'operation' => 'update',
                    'sql' => $updateSQL . " [VALUES: '{$name}', '{$platform}', {$isActive}, {$stillInList}, '{$pageId}', {$companyId}]",
                    'error' => $e->getMessage()
                ];
            }
        } else {
            // Generate INSERT SQL using prepared statement
            $insertSQL = "INSERT INTO pages (page_id, name, platform, company_id, active, still_in_list) VALUES (?, ?, ?, ?, ?, ?)";
            $insertSQLs[] = $insertSQL . " [VALUES: '{$pageId}', '{$name}', '{$platform}', {$companyId}, {$isActive}, {$stillInList}]";
            
            try {
                $stmt = $pdo->prepare($insertSQL);
                $result = $stmt->execute([$pageId, $name, $platform, $companyId, $isActive, $stillInList]);
                
                if ($result) {
                    if ($stmt->rowCount() > 0) {
                        $insertedCount++;
                        error_log("Successfully inserted page: $pageId, still_in_list: {$stillInList}");
                    } else {
                        error_log("Failed to insert page: $pageId");
                        $errorCount++;
                    }
                } else {
                    error_log("Failed to insert page: $pageId");
                    $errorCount++;
                }
            } catch (Exception $e) {
                error_log("Error inserting page $pageId: " . $e->getMessage());
                $errorCount++;
                $errorDetails[] = [
                    'pageId' => $pageId,
                    'operation' => 'insert',
                    'sql' => $insertSQL . " [VALUES: '{$pageId}', '{$name}', '{$platform}', {$companyId}, {$isActive}, {$stillInList}]",
                    'error' => $e->getMessage()
                ];
            }
        }
    }
    
    $pdo->commit();
    
    echo json_encode([
        'ok' => true,
        'synced' => count($pages),
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
    echo json_encode(['error' => 'SYNC_FAILED', 'message' => $e->getMessage()]);
}
?>