<?php
require_once __DIR__ . '/config.php';

header('Content-Type: text/plain; charset=utf-8');

$targetId = '251215-00006admin1at';

echo "=== CHECKING ORDER: $targetId ===\n";

try {
    $pdo = db_connect();
    echo "Connected to DB: " . $pdo->query("SELECT DATABASE()")->fetchColumn() . "\n\n";

    // 1. Check if order exists
    $stmt = $pdo->prepare("SELECT id, order_status FROM orders WHERE id = ?");
    $stmt->execute([$targetId]);
    $order = $stmt->fetch();
    
    if (!$order) {
        echo "FAIL: Order NOT found in 'orders' table.\n";
    } else {
        echo "PASS: Order found in 'orders' table (Status: " . $order['order_status'] . ").\n";
    }

    echo "\n=== QUERYING RECONCILE LOGS ===\n";
    
    // 2. Search logs specifically
    $sql = "SELECT * FROM statement_reconcile_logs 
            WHERE order_id = ? 
               OR confirmed_order_id = ?
               OR order_id LIKE ? 
               OR confirmed_order_id LIKE ?";
               
    $stmt = $pdo->prepare($sql);
    $likeId = "%$targetId%";
    $stmt->execute([$targetId, $targetId, $likeId, $likeId]);
    $logs = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (count($logs) === 0) {
        echo "FAIL: NO matching records found in statement_reconcile_logs.\n";
        echo "Possible reasons:\n";
        echo "  1. The reconciliation was not actually saved.\n";
        echo "  2. It was saved to a DIFFERENT Database.\n";
    } else {
        echo "Found " . count($logs) . " records:\n";
        foreach ($logs as $log) {
            echo "------------------------------------------------\n";
            echo "ID: " . $log['id'] . "\n";
            echo "Action: [" . $log['confirmed_action'] . "]\n";
            echo "Order ID in Log: [" . $log['order_id'] . "]\n";
            echo "Confirmed Order ID in Log: [" . $log['confirmed_order_id'] . "]\n";
            
            // Analyze Match
            $matchType = "NONE";
            if ($log['order_id'] === $targetId) $matchType = "EXACT (order_id)";
            elseif ($log['confirmed_order_id'] === $targetId) $matchType = "EXACT (confirmed_order_id)";
            else $matchType = "PARTIAL/WHITESPACE MISMATCH";
            
            echo "Match Type: $matchType\n";
            
            if ($log['confirmed_action'] !== 'Confirmed') {
                echo "WARNING: Action is NOT 'Confirmed'.\n";
            }
        }
    }

} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
?>
