<?php
require_once __DIR__ . '/config.php';

header('Content-Type: text/plain');

$targetId = '251126-00035telesale1ad';

try {
    $pdo = db_connect();
    echo "Connected. Testing exact API query for: $targetId\n\n";

    // This is the logic currently in api/index.php
    $sql = "SELECT 
                o.id, 
                o.order_status,
                MAX(CASE WHEN srl.confirmed_action = 'Confirmed' THEN 'Confirmed' ELSE NULL END) as reconcile_action,
                GROUP_CONCAT(srl.confirmed_action) as all_actions,
                GROUP_CONCAT(srl.order_id) as log_order_ids,
                GROUP_CONCAT(srl.confirmed_order_id) as log_confirmed_order_ids
            FROM orders o
            LEFT JOIN statement_reconcile_logs srl ON (
                srl.order_id COLLATE utf8mb4_unicode_ci = o.id 
                OR srl.confirmed_order_id COLLATE utf8mb4_unicode_ci = o.id
            )
            WHERE o.id = ?
            GROUP BY o.id";

    $stmt = $pdo->prepare($sql);
    $stmt->execute([$targetId]);
    $result = $stmt->fetch();
    
    print_r($result);

} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
?>
