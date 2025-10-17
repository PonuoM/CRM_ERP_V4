<?php
// Disable error reporting to prevent HTML in JSON response
error_reporting(0);
ini_set('display_errors', 0);

// Set headers
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Function to send JSON response and exit
function sendJsonResponse($success, $message = '', $data = []) {
    $response = ['success' => $success];
    if (!$success) {
        $response['error'] = $message;
    } else {
        $response['message'] = $message;
    }
    $response = array_merge($response, $data);
    echo json_encode($response, JSON_UNESCAPED_UNICODE);
    exit;
}

// Include database configuration
require_once '../config.php';

// Get POST data
$json = file_get_contents('php://input');
$data = json_decode($json, true);

if (!$data) {
    sendJsonResponse(false, 'Invalid JSON data');
}

// Validate required fields
if (!isset($data['batchIds']) || !is_array($data['batchIds']) || empty($data['batchIds'])) {
    sendJsonResponse(false, 'Missing or invalid batchIds field');
}

try {
    // Create database connection using the db_connect function
    $conn = db_connect();
    
    // Start transaction
    $conn->beginTransaction();
    
    $deletedBatches = 0;
    $deletedLogs = 0;
    $batchIds = $data['batchIds'];
    
    // Prepare placeholders for IN clause
    $placeholders = str_repeat('?,', count($batchIds) - 1) . '?';
    
    // First, delete from page_stats_log table
    $stmt = $conn->prepare("DELETE FROM page_stats_log WHERE batch_id IN ($placeholders)");
    $stmt->execute($batchIds);
    $deletedLogs = $stmt->rowCount();
    
    // Then, delete from page_stats_batch table
    $stmt = $conn->prepare("DELETE FROM page_stats_batch WHERE id IN ($placeholders)");
    $stmt->execute($batchIds);
    $deletedBatches = $stmt->rowCount();
    
    // Commit transaction
    $conn->commit();
    
    sendJsonResponse(true, "Successfully deleted $deletedBatches batches and $deletedLogs log records", [
        'deletedBatches' => $deletedBatches,
        'deletedLogs' => $deletedLogs
    ]);
    
} catch (Exception $e) {
    // Rollback transaction if error occurred
    if (isset($conn)) {
        try {
            $conn->rollback();
        } catch (Exception $rollbackEx) {
            // Ignore rollback errors
        }
    }
    
    sendJsonResponse(false, $e->getMessage());
}
?>