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

try {
    // Create database connection using the db_connect function
    $conn = db_connect();
    
    // Start transaction
    $conn->beginTransaction();
    
    // Create batch record
    $dateRange = $data['dateRange'] ?? '';
    $userId = $data['userId'] ?? null;
    $status = 'processing';
    
    $stmt = $conn->prepare("INSERT INTO page_engagement_batch (date_range, status, user_id) VALUES (?, ?, ?)");
    $stmt->execute([$dateRange, $status, $userId]);
    $batchId = $conn->lastInsertId();
    
    // Process engagement data for each page
    $engagementData = $data['engagementData'] ?? [];
    $totalRecords = 0;
    
    // Debug: Log the received data
    error_log("Received engagement data: " . print_r($engagementData, true));
    error_log("Number of pages: " . count($engagementData));
    
    foreach ($engagementData as $pageIndex => $pageData) {
        // Debug: Log each page
        error_log("Processing page $pageIndex: " . print_r($pageData, true));
        
        $pageId = $pageData['pageId'] ?? '';
        $data = $pageData['data'] ?? [];
        
        if (empty($pageId) || empty($data)) {
            error_log("Skipping page due to missing pageId or data");
            continue;
        }
        
        $categories = $data['categories'] ?? [];
        $series = $data['series'] ?? [];
        
        // Create series data map for easy access
        $seriesMap = [];
        foreach ($series as $serie) {
            $seriesMap[$serie['name']] = $serie['data'];
        }
        
        // Insert log records for each date
        foreach ($categories as $index => $date) {
            // Convert date from DD/MM/YYYY to YYYY-MM-DD
            $dateParts = explode('/', $date);
            if (count($dateParts) === 3) {
                $formattedDate = $dateParts[2] . '-' . str_pad($dateParts[1], 2, '0', STR_PAD_LEFT) . '-' . str_pad($dateParts[0], 2, '0', STR_PAD_LEFT);
            } else {
                $formattedDate = $date; // Use as-is if format is unexpected
            }
            
            $inbox = intval($seriesMap['inbox'][$index] ?? 0);
            $comment = intval($seriesMap['comment'][$index] ?? 0);
            $total = intval($seriesMap['total'][$index] ?? 0);
            $newCustomerReplied = intval($seriesMap['new_customer_replied'][$index] ?? 0);
            $customerEngagementNewInbox = intval($seriesMap['customer_engagement_new_inbox'][$index] ?? 0);
            $orderCount = intval($seriesMap['order_count'][$index] ?? 0);
            $oldOrderCount = intval($seriesMap['old_order_count'][$index] ?? 0);
            
            $stmt = $conn->prepare("
                INSERT INTO page_engagement_log (
                    batch_id, page_id, date, inbox, comment, total,
                    new_customer_replied, customer_engagement_new_inbox, order_count, old_order_count
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([
                $batchId, $pageId, $formattedDate, $inbox, $comment, $total,
                $newCustomerReplied, $customerEngagementNewInbox, $orderCount, $oldOrderCount
            ]);
            $totalRecords++;
        }
    }
    
    // Update batch record with completed status and record count
    $status = 'completed';
    $stmt = $conn->prepare("UPDATE page_engagement_batch SET status = ?, records_count = ? WHERE id = ?");
    $stmt->execute([$status, $totalRecords, $batchId]);
    
    // Commit transaction
    $conn->commit();
    
    sendJsonResponse(true, "Successfully imported $totalRecords records", [
        'batchId' => $batchId,
        'recordsCount' => $totalRecords
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
    
    // Update batch record with failed status if batch was created
    if (isset($batchId) && isset($conn)) {
        try {
            $status = 'failed';
            $stmt = $conn->prepare("UPDATE page_engagement_batch SET status = ? WHERE id = ?");
            $stmt->execute([$status, $batchId]);
        } catch (Exception $updateEx) {
            // Ignore update errors
        }
    }
    
    sendJsonResponse(false, $e->getMessage());
}
?>