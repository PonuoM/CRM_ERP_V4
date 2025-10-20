<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once '../config.php';

// Get POST data
$json = file_get_contents('php://input');
$data = json_decode($json, true);

if (!$data) {
    echo json_encode(['success' => false, 'error' => 'Invalid JSON data']);
    exit;
}

try {
    // Start transaction
    $conn->begin_transaction();
    
    // Create batch record
    $dateRange = $data['dateRange'] ?? '';
    $userId = $data['userId'] ?? null;
    $status = 'processing';
    
    $stmt = $conn->prepare("INSERT INTO page_engagement_batch (date_range, status, user_id) VALUES (?, ?, ?)");
    $stmt->bind_param("ssi", $dateRange, $status, $userId);
    $stmt->execute();
    $batchId = $conn->insert_id;
    
    // Process engagement data for each page
    $engagementData = $data['engagementData'] ?? [];
    $totalRecords = 0;
    
    foreach ($engagementData as $pageData) {
        $pageId = $pageData['pageId'] ?? '';
        $data = $pageData['data'] ?? [];
        
        if (empty($pageId) || empty($data)) {
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
            
            $inbox = $seriesMap['inbox'][$index] ?? 0;
            $comment = $seriesMap['comment'][$index] ?? 0;
            $total = $seriesMap['total'][$index] ?? 0;
            $newCustomerReplied = $seriesMap['new_customer_replied'][$index] ?? 0;
            $customerEngagementNewInbox = $seriesMap['customer_engagement_new_inbox'][$index] ?? 0;
            $orderCount = $seriesMap['order_count'][$index] ?? 0;
            $oldOrderCount = $seriesMap['old_order_count'][$index] ?? 0;
            
            $stmt = $conn->prepare("INSERT INTO page_engagement_log (batch_id, page_id, date, inbox, comment, total, new_customer_replied, customer_engagement_new_inbox, order_count, old_order_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
            $stmt->bind_param("issiiiiiii", $batchId, $pageId, $formattedDate, $inbox, $comment, $total, $newCustomerReplied, $customerEngagementNewInbox, $orderCount, $oldOrderCount);
            $stmt->execute();
            $totalRecords++;
        }
    }
    
    // Update batch record with completed status and record count
    $status = 'completed';
    $stmt = $conn->prepare("UPDATE page_engagement_batch SET status = ?, records_count = ? WHERE id = ?");
    $stmt->bind_param("sii", $status, $totalRecords, $batchId);
    $stmt->execute();
    
    // Commit transaction
    $conn->commit();
    
    echo json_encode([
        'success' => true, 
        'batchId' => $batchId,
        'recordsCount' => $totalRecords,
        'message' => 'Engagement data uploaded successfully'
    ]);
    
} catch (Exception $e) {
    // Rollback transaction on error
    $conn->rollback();
    
    // Update batch record with failed status if batch was created
    if (isset($batchId)) {
        $status = 'failed';
        $stmt = $conn->prepare("UPDATE page_engagement_batch SET status = ? WHERE id = ?");
        $stmt->bind_param("si", $status, $batchId);
        $stmt->execute();
    }
    
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}

$conn->close();
?>