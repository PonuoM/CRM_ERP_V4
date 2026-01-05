<?php
require_once 'api/config.php';

$pdo = db_connect();

$orderId = '260102-00015wrnpx';

echo "=== Searching for Order: $orderId ===\n\n";

// 1. Search by exact ID
$sql = "SELECT id, order_date, total_amount, order_status, sales_channel_page_id, 
               company_id, creator_id, customer_id, sales_channel
        FROM orders 
        WHERE id = ?";
$stmt = $pdo->prepare($sql);
$stmt->execute([$orderId]);
$order = $stmt->fetch(PDO::FETCH_ASSOC);

if ($order) {
    echo "=== Order Found ===\n";
    echo "ID: " . $order['id'] . "\n";
    echo "Order Date (raw): " . $order['order_date'] . "\n";
    echo "Order Date (formatted): " . date('Y-m-d H:i:s', strtotime($order['order_date'])) . "\n";
    echo "Total Amount: " . number_format($order['total_amount'], 2) . "\n";
    echo "Order Status: " . $order['order_status'] . "\n";
    echo "Company ID: " . $order['company_id'] . "\n";
    echo "Sales Channel: " . $order['sales_channel'] . "\n";
    echo "Sales Channel Page ID: " . ($order['sales_channel_page_id'] ?? 'NULL') . "\n";
    echo "Creator ID: " . $order['creator_id'] . "\n";
    echo "Customer ID: " . $order['customer_id'] . "\n";
    
    // Check if page exists
    if ($order['sales_channel_page_id']) {
        $sql2 = "SELECT id, name, company_id FROM pages WHERE id = ?";
        $stmt2 = $pdo->prepare($sql2);
        $stmt2->execute([$order['sales_channel_page_id']]);
        $page = $stmt2->fetch(PDO::FETCH_ASSOC);
        if ($page) {
            echo "\n=== Linked Page ===\n";
            echo "Page ID: " . $page['id'] . "\n";
            echo "Page Name: " . $page['name'] . "\n";
            echo "Page Company ID: " . $page['company_id'] . "\n";
        } else {
            echo "\n⚠️ Page ID " . $order['sales_channel_page_id'] . " NOT FOUND in pages table!\n";
        }
    }
    
    // Analyze date format
    echo "\n=== Date Analysis ===\n";
    $rawDate = $order['order_date'];
    echo "Raw value from DB: '$rawDate'\n";
    echo "PHP strtotime: " . strtotime($rawDate) . "\n";
    echo "Interpreted as: " . date('Y-m-d', strtotime($rawDate)) . "\n";
    
    // Check if it matches 2026-01-02
    $targetDate = '2026-01-02';
    $orderDateOnly = date('Y-m-d', strtotime($rawDate));
    echo "\nTarget Date: $targetDate\n";
    echo "Order Date: $orderDateOnly\n";
    echo "Match: " . ($orderDateOnly === $targetDate ? 'YES ✓' : 'NO ✗') . "\n";
    
} else {
    echo "Order not found by exact ID.\n";
    
    // Try partial search
    echo "\n=== Trying partial search (LIKE) ===\n";
    $sql3 = "SELECT id, order_date, total_amount, company_id FROM orders WHERE id LIKE ? LIMIT 5";
    $stmt3 = $pdo->prepare($sql3);
    $stmt3->execute(['%260102%']);
    $partialResults = $stmt3->fetchAll(PDO::FETCH_ASSOC);
    
    if (!empty($partialResults)) {
        foreach ($partialResults as $r) {
            echo "Found: {$r['id']} | Date: {$r['order_date']} | Company: {$r['company_id']}\n";
        }
    } else {
        echo "No orders found with '260102' in ID.\n";
    }
}

echo "\nDone.\n";
