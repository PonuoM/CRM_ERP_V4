<?php
require_once __DIR__ . '/../config.php';

try {
    $pdo = db_connect();
    echo "Connected. Fixing reconcile logs...\n";

    // Update order_id to match confirmed_order_id for confirmed records
    // where they differ (or order_id is NULL)
    // Only where confirmed_order_id is set (not null/empty)
    $sql = "UPDATE statement_reconcile_logs 
            SET order_id = confirmed_order_id 
            WHERE confirmed_action = 'Confirmed' 
              AND confirmed_order_id IS NOT NULL 
              AND confirmed_order_id != ''
              AND (order_id IS NULL OR order_id != confirmed_order_id)";

    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    
    echo "Updated " . $stmt->rowCount() . " records.\n";

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
?>
