<?php
// Disable error reporting to prevent HTML in JSON response
error_reporting(0);
ini_set('display_errors', 0);

// Set headers
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
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
$requiredFields = ['dateRange', 'pages', 'viewMode', 'apiData'];
foreach ($requiredFields as $field) {
    if (!isset($data[$field])) {
        sendJsonResponse(false, "Missing required field: $field");
    }
}

try {
    // Create database connection using the db_connect function
    $conn = db_connect();
    
    // Start transaction
    $conn->beginTransaction();
    
    // Create batch record
    $dateRange = $data['dateRange'];
    $stmt = $conn->prepare("INSERT INTO page_stats_batch (date_range) VALUES (?)");
    $stmt->execute([$dateRange]);
    $batchId = $conn->lastInsertId();
    
    // Prepare statement for inserting stats data
    $stmt = $conn->prepare("
        INSERT INTO page_stats_log (
            batch_id, page_id, page_name, time_column,
            new_customers, total_phones, new_phones,
            total_comments, total_chats, total_page_comments,
            total_page_chats, new_chats, chats_from_old_customers,
            web_logged_in, web_guest, orders_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
        new_customers = VALUES(new_customers),
        total_phones = VALUES(total_phones),
        new_phones = VALUES(new_phones),
        total_comments = VALUES(total_comments),
        total_chats = VALUES(total_chats),
        total_page_comments = VALUES(total_page_comments),
        total_page_chats = VALUES(total_page_chats),
        new_chats = VALUES(new_chats),
        chats_from_old_customers = VALUES(chats_from_old_customers),
        web_logged_in = VALUES(web_logged_in),
        web_guest = VALUES(web_guest),
        orders_count = VALUES(orders_count)
    ");
    
    // Insert all data
    $insertedCount = 0;
    $apiData = $data['apiData'];
    
    // Debug: Log the received data
    error_log("Received API data: " . print_r($apiData, true));
    error_log("Number of items: " . count($apiData));
    
    foreach ($apiData as $index => $item) {
        // Debug: Log each item
        error_log("Processing item $index: " . print_r($item, true));
        $pageId = $item['page_id'] ?? '';
        $pageName = $item['page_name'] ?? '';
        $timeColumn = $item['time_column'] ?? '';
        $newCustomers = intval($item['new_customers'] ?? 0);
        $totalPhones = intval($item['total_phones'] ?? 0);
        $newPhones = intval($item['new_phones'] ?? 0);
        $totalComments = intval($item['total_comments'] ?? 0);
        $totalChats = intval($item['total_chats'] ?? 0);
        $totalPageComments = intval($item['total_page_comments'] ?? 0);
        $totalPageChats = intval($item['total_page_chats'] ?? 0);
        $newChats = intval($item['new_chats'] ?? 0);
        $chatsFromOldCustomers = intval($item['chats_from_old_customers'] ?? 0);
        $webLoggedIn = intval($item['web_logged_in'] ?? 0);
        $webGuest = intval($item['web_guest'] ?? 0);
        $ordersCount = intval($item['orders_count'] ?? 0);
        
        $stmt->execute([
            $batchId, $pageId, $pageName, $timeColumn,
            $newCustomers, $totalPhones, $newPhones,
            $totalComments, $totalChats, $totalPageComments,
            $totalPageChats, $newChats, $chatsFromOldCustomers,
            $webLoggedIn, $webGuest, $ordersCount
        ]);
        
        $insertedCount++;
    }
    
    // Commit transaction
    $conn->commit();
    
    sendJsonResponse(true, "Successfully imported $insertedCount records", [
        'batchId' => $batchId,
        'insertedCount' => $insertedCount
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