<?php
/**
 * Sync customer order data from orders table
 * Updates last_order_date and order_count in customers table
 */

require_once __DIR__ . '/config.php';

$pdo = db_connect();

echo "=== Syncing customer order data ===\n\n";

// Update last_order_date and order_count from orders table
$updateQuery = "
    UPDATE customers c
    SET 
        last_order_date = (
            SELECT MAX(o.order_date) 
            FROM orders o 
            WHERE o.customer_id = c.customer_id
        ),
        order_count = (
            SELECT COUNT(*) 
            FROM orders o 
            WHERE o.customer_id = c.customer_id
        )
    WHERE c.company_id = 1
";

$affected = $pdo->exec($updateQuery);
echo "Updated $affected customers\n";

// Check results
$stmt = $pdo->query("
    SELECT c.customer_id, c.first_name, c.last_name, c.last_order_date, c.order_count,
           DATEDIFF(NOW(), c.last_order_date) as days_since
    FROM customers c 
    WHERE c.company_id = 1 AND c.order_count > 0
    LIMIT 15
");
echo "\nCustomers with orders:\n";
while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    echo "  {$row['first_name']} {$row['last_name']}: {$row['last_order_date']} ({$row['days_since']} days ago), count={$row['order_count']}\n";
}

// Count totals
$stmt = $pdo->query("SELECT COUNT(*) FROM customers WHERE company_id = 1 AND order_count > 0");
echo "\nTotal customers with orders: " . $stmt->fetchColumn() . "\n";

$stmt = $pdo->query("SELECT COUNT(*) FROM customers WHERE company_id = 1 AND order_count = 0");
echo "Total customers without orders: " . $stmt->fetchColumn() . "\n";
