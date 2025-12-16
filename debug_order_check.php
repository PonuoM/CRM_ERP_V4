<?php
require_once __DIR__ . '/config.php';

header('Content-Type: text/plain');

$targetId = '251126-00035telesale1ad';

try {
    $pdo = db_connect();
    echo "Connected. Checking Order: $targetId\n\n";

    // 1. Check Order existence
    $stmt = $pdo->prepare("SELECT id, payment_status, order_status FROM orders WHERE id = ?");
    $stmt->execute([$targetId]);
    $order = $stmt->fetch();
    echo "1. Order Table:\n";
    print_r($order);
    echo "\n";

    // 2. Check Reconcile Log existence (by order_id)
    $stmt = $pdo->prepare("SELECT id, order_id, confirmed_order_id, confirmed_action FROM statement_reconcile_logs WHERE order_id = ?");
    $stmt->execute([$targetId]);
    $logByOrder = $stmt->fetchAll();
    echo "2. Reconcile Logs (by order_id):\n";
    print_r($logByOrder);
    echo "\n";

    // 3. Check Reconcile Log existence (by confirmed_order_id)
    $stmt = $pdo->prepare("SELECT id, order_id, confirmed_order_id, confirmed_action FROM statement_reconcile_logs WHERE confirmed_order_id = ?");
    $stmt->execute([$targetId]);
    $logByConfirmed = $stmt->fetchAll();
    echo "3. Reconcile Logs (by confirmed_order_id):\n";
    print_r($logByConfirmed);
    echo "\n";

    // 4. Test the Main Query Join logic
    echo "4. Testing Main JOIN Query:\n";
    $sql = "SELECT o.id, srl.id as log_id, srl.confirmed_action 
            FROM orders o
            LEFT JOIN statement_reconcile_logs srl ON (srl.order_id = o.id OR srl.confirmed_order_id = o.id)
            WHERE o.id = ?";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$targetId]);
    $result = $stmt->fetchAll();
    print_r($result);
    echo "\n";
    
    // 5. Check Collations
    echo "5. Collations:\n";
    $res = $pdo->query("SELECT @@collation_connection, @@character_set_connection")->fetch();
    print_r($res);
    
    $cols = $pdo->query("SHOW FULL COLUMNS FROM orders LIKE 'id'")->fetch();
    echo "Orders.id Collation: " . $cols['Collation'] . "\n";
    
    $cols2 = $pdo->query("SHOW FULL COLUMNS FROM statement_reconcile_logs LIKE 'order_id'")->fetch();
    echo "Logs.order_id Collation: " . $cols2['Collation'] . "\n";
    
    $cols3 = $pdo->query("SHOW FULL COLUMNS FROM statement_reconcile_logs LIKE 'confirmed_order_id'")->fetch();
    echo "Logs.confirmed_order_id Collation: " . $cols3['Collation'] . "\n";

} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
?>
