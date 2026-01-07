<?php
/**
 * Script to find and fix orders with invalid sales_channel_page_id values
 * These are orders where the page_id references a non-existent page
 */

require_once __DIR__ . '/../config.php';

$db = db_connect();
if (!$db) {
    echo "Database connection failed\n";
    exit(1);
}

// Find orders with invalid page IDs
$sql = "
SELECT 
    o.id as order_id,
    o.order_date,
    o.sales_channel,
    o.sales_channel_page_id,
    o.order_status,
    p.id as page_exists
FROM orders o
LEFT JOIN pages p ON o.sales_channel_page_id = p.id
WHERE o.sales_channel_page_id IS NOT NULL 
  AND o.sales_channel_page_id != ''
  AND o.sales_channel_page_id != 0
  AND p.id IS NULL
ORDER BY o.order_date DESC
LIMIT 100
";

try {
    $stmt = $db->query($sql);
    $invalidOrders = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "=== Orders with Invalid Page IDs ===\n";
    echo "Found " . count($invalidOrders) . " orders with invalid sales_channel_page_id\n\n";
    
    if (count($invalidOrders) > 0) {
        echo "Order ID | Order Date | Sales Channel | Invalid Page ID | Order Status\n";
        echo str_repeat("-", 80) . "\n";
        
        foreach ($invalidOrders as $order) {
            printf(
                "%s | %s | %s | %s | %s\n",
                str_pad($order['order_id'], 25),
                $order['order_date'],
                str_pad($order['sales_channel'] ?? '-', 10),
                str_pad($order['sales_channel_page_id'], 5),
                $order['order_status']
            );
        }
        
        echo "\n=== Fix Command ===\n";
        echo "Run the following SQL to clear invalid page IDs:\n\n";
        echo "UPDATE orders o\n";
        echo "LEFT JOIN pages p ON o.sales_channel_page_id = p.id\n";
        echo "SET o.sales_channel_page_id = NULL\n";
        echo "WHERE o.sales_channel_page_id IS NOT NULL\n";
        echo "  AND o.sales_channel_page_id != ''\n";
        echo "  AND o.sales_channel_page_id != 0\n";
        echo "  AND p.id IS NULL;\n";
    }
    
    // Also check orders with sales_channel = 'โทร' that have a page_id set
    $sql2 = "
    SELECT 
        COUNT(*) as count
    FROM orders
    WHERE sales_channel = 'โทร'
      AND sales_channel_page_id IS NOT NULL
      AND sales_channel_page_id != ''
      AND sales_channel_page_id != 0
    ";
    
    $stmt2 = $db->query($sql2);
    $phoneWithPage = $stmt2->fetch(PDO::FETCH_ASSOC);
    
    echo "\n=== Orders with sales_channel='โทร' but has page_id set ===\n";
    echo "Found " . $phoneWithPage['count'] . " orders\n";
    
    if ($phoneWithPage['count'] > 0) {
        echo "\nRun the following SQL to clear page IDs for phone orders:\n\n";
        echo "UPDATE orders SET sales_channel_page_id = NULL\n";
        echo "WHERE sales_channel = 'โทร'\n";
        echo "  AND sales_channel_page_id IS NOT NULL;\n";
    }
    
} catch (PDOException $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
