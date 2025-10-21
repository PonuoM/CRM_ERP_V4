<?php
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
    
    if (!$input) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid JSON input']);
        exit;
    }
    
    $pageUserId = $input['pageUserId'] ?? null;
    $internalUserId = $input['internalUserId'] ?? null;
    
    if (!$pageUserId || !$internalUserId) {
        http_response_code(400);
        echo json_encode(['error' => 'pageUserId and internalUserId are required']);
        exit;
    }
    
    $pdo->beginTransaction();
    
    // Update the page_user record with the internal user ID
    $updateSQL = "UPDATE page_user SET user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?";
    $stmt = $pdo->prepare($updateSQL);
    $result = $stmt->execute([$internalUserId, $pageUserId]);
    
    if ($result && $stmt->rowCount() > 0) {
        $pdo->commit();
        echo json_encode([
            'ok' => true,
            'message' => 'User connection updated successfully',
            'pageUserId' => $pageUserId,
            'internalUserId' => $internalUserId
        ]);
    } else {
        $pdo->rollBack();
        http_response_code(404);
        echo json_encode(['error' => 'Page user not found or no changes made']);
    }
    
} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    
    http_response_code(500);
    echo json_encode(['error' => 'UPDATE_PAGE_USER_FAILED', 'message' => $e->getMessage()]);
}
?>