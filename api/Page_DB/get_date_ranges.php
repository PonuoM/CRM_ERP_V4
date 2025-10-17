<?php
// Disable error reporting to prevent HTML in JSON response
error_reporting(0);
ini_set('display_errors', 0);

// Set headers
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
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

try {
    // Create database connection using the db_connect function
    $conn = db_connect();
    
    // Query to get all date ranges from page_stats_batch with additional info
    $stmt = $conn->query("SELECT b.id, b.date_range, b.created_at, COUNT(l.id) as record_count FROM page_stats_batch b LEFT JOIN page_stats_log l ON b.id = l.batch_id GROUP BY b.id ORDER BY b.created_at DESC");
    $dateRanges = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Parse date ranges to extract individual dates
    $existingDates = [];
    foreach ($dateRanges as $range) {
        // Parse date_range format "YYYY-MM-DDTHH:mm - YYYY-MM-DDTHH:mm"
        if (preg_match('/(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}\s*-\s*(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}/', $range['date_range'], $matches)) {
            $startDate = new DateTime($matches[1]);
            $endDate = new DateTime($matches[2]);
            
            // Add all dates in the range to the array
            $interval = new DateInterval('P1D');
            $datePeriod = new DatePeriod($startDate, $interval, $endDate->modify('+1 day'));
            
            foreach ($datePeriod as $date) {
                $existingDates[] = $date->format('Y-m-d');
            }
        }
    }
    
    // Remove duplicates and sort
    $existingDates = array_unique($existingDates);
    sort($existingDates);
    
    sendJsonResponse(true, "Successfully retrieved existing date ranges", [
        'dateRanges' => $dateRanges,
        'existingDates' => array_values($existingDates)
    ]);
    
} catch (Exception $e) {
    sendJsonResponse(false, $e->getMessage());
}
?>