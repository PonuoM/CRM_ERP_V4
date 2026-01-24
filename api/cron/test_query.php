<?php
// Test script to debug the exact SQL query
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

header('Content-Type: text/html; charset=utf-8');
echo "<pre>\n";

echo "Step 1: Script running\n";

require_once __DIR__ . '/../config.php';
echo "Step 2: Config loaded\n";

$pdo = db_connect();
echo "Step 3: DB connected\n";

// Test the exact query from process_picking_baskets.php
try {
    echo "Step 4: Preparing query...\n";
    $stmt = $pdo->prepare("
        SELECT DISTINCT 
            o.id as order_id,
            o.customer_id,
            o.creator_id,
            o.order_status,
            o.order_date,
            c.customer_id as customer_pk,
            c.assigned_to,
            c.current_basket_key,
            u.role_id as creator_role_id
        FROM orders o
        INNER JOIN customers c ON (c.customer_ref_id = o.customer_id OR c.customer_id = o.customer_id)
        LEFT JOIN users u ON u.id = o.creator_id
        WHERE o.order_status = 'Picking'
          AND c.current_basket_key != 39
          AND o.order_date >= DATE_SUB(NOW(), INTERVAL 30 MINUTE)
        ORDER BY o.order_date DESC
        LIMIT 10
    ");
    echo "Step 5: Query prepared\n";
    
    $stmt->execute();
    echo "Step 6: Query executed\n";
    
    $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo "Step 7: Found " . count($orders) . " orders\n\n";
    
    if (count($orders) > 0) {
        echo "First order:\n";
        print_r($orders[0]);
    } else {
        echo "No picking orders in last 30 minutes\n";
    }
    
} catch (Exception $e) {
    echo "ERROR at Step 4-7: " . $e->getMessage() . "\n";
    echo "Trace: " . $e->getTraceAsString() . "\n";
}

echo "\nStep DONE!\n";
echo "</pre>";
?>
