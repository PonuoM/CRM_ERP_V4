<?php
// Simulate GET request with date fields
$_SERVER['REQUEST_METHOD'] = 'GET';
$_GET['startDate'] = '2025-01-01'; // Adjust as needed to match data
$_GET['endDate'] = '2025-12-31';
$_GET['q'] = ''; 

// Mock PDO and other dependencies if possible, or just include the actual file if it can run standalone (usually tricky with auth)
// Instead, I'll use curl to hit the local endpoint if I can, or just rely on the fact that I replaced the code.
// Given previous patterns, I'll make a script that includes config and runs the function if accessible, 
// or just a curl script.

require_once 'api/config.php';
require_once 'api/Accounting/sent_orders.php';

// Mock DB connection
try {
    $pdo = db_connect();
    
    // We need to capture output
    ob_start();
    handle_sent_orders($pdo);
    $output = ob_get_clean();
    
    $data = json_decode($output, true);
    
    echo "Status: " . (is_array($data) ? "OK" : "Error") . "\n";
    if (is_array($data)) {
        echo "Count: " . count($data) . "\n";
        if (count($data) > 0) {
            echo "First Order Date: " . ($data[0]['delivery_date'] ?? $data[0]['order_date']) . "\n";
        }
    } else {
        echo "Response: " . substr($output, 0, 100) . "...\n";
    }

} catch (Exception $e) {
    echo "Exception: " . $e->getMessage();
}
