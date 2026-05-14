<?php
require_once __DIR__ . '/../config.php';

try {
    $pdo = db_connect();
    ini_set('max_execution_time', 300);

    $sql = "
        UPDATE customers c
        SET c.current_basket_sales_amount = COALESCE((
            SELECT SUM(total_amount)
            FROM orders o
            WHERE o.customer_id = c.customer_id
              AND o.order_date >= c.basket_entered_date
              AND o.creator_id = c.assigned_to
              AND o.order_status IN ('Preparing', 'Shipping', 'Delivered')
        ), 0)
        WHERE c.basket_entered_date IS NOT NULL AND c.assigned_to IS NOT NULL;
    ";
    
    $affected = $pdo->exec($sql);
    echo "Backfill complete! Updated $affected rows.";
} catch (Exception $e) {
    echo "Backfill failed: " . $e->getMessage();
}
