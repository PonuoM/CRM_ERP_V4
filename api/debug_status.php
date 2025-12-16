<?php
// api/debug_status.php
require_once __DIR__ . '/../config.php';

header('Content-Type: text/plain; charset=utf-8');

try {
    // Override config with user-provided local credentials
    $DB_USER = 'root';
    $DB_PASS = '12345678';
    $DB_NAME = 'mini_erp'; // Correct DB name
    
    $pdo = db_connect();
    
    // Explicitly set connection charset to match what might be default
    $pdo->exec("SET NAMES utf8mb4");

    echo "=== DEBUG RECONCILE STATUS (EXACT JOIN TEST) ===\n";
    
    $targetOrderId = '251126-00035telesale1ad';
    echo "Testing Order ID: $targetOrderId\n\n";

    // This query mirrors api/index.php logic EXACTLY
    $sql = "SELECT 
                o.id, 
                o.order_status,
                MAX(CASE WHEN srl.confirmed_action = 'Confirmed' THEN 'Confirmed' ELSE NULL END) as reconcile_action_calculated,
                srl.confirmed_action as raw_action,
                srl.order_id as log_order_id,
                srl.confirmed_order_id as log_confirmed_order_id
            FROM orders o
            LEFT JOIN statement_reconcile_logs srl ON (
                srl.order_id COLLATE utf8mb4_unicode_ci = o.id 
                OR srl.confirmed_order_id COLLATE utf8mb4_unicode_ci = o.id
            )
            WHERE o.id = ?
            GROUP BY o.id";
            
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$targetOrderId]);
    $result = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$result) {
        echo "Order NOT FOUND in database.\n";
    } else {
        echo "Order Found:\n";
        print_r($result);
        
        echo "\nAnalysis:\n";
        if ($result['reconcile_action_calculated'] === 'Confirmed') {
            echo " [PASS] Query logic WORKS. The API should be returning 'Confirmed'.\n";
            echo "        If it still doesn't show, check Frontend Filtering or Caching.\n";
        } else {
            echo " [FAIL] Query logic FAILS. The JOIN did not verify the confirmation.\n";
            echo "        Reason: The 'Left Join' failed to match the IDs even with Collation fix.\n";
        }
    }

} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
?>
