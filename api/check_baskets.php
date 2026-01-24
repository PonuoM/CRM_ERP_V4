<?php
require_once __DIR__ . '/config.php';

$pdo = db_connect();

echo "=== Checking current_basket_key for ASSIGNED customers ===\n\n";

// Customers with assigned_to NOT NULL grouped by current_basket_key
$stmt = $pdo->query("
    SELECT current_basket_key, COUNT(*) as cnt 
    FROM customers 
    WHERE company_id = 1 AND assigned_to IS NOT NULL 
    GROUP BY current_basket_key 
    ORDER BY cnt DESC
");
echo "Basket breakdown for ASSIGNED customers:\n";
while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    $key = $row['current_basket_key'] ?: 'NULL';
    echo "  $key: {$row['cnt']}\n";
}

echo "\n=== Checking basket_config table ===\n";
$stmt = $pdo->query("
    SELECT basket_key, basket_name, target_page, linked_basket_key 
    FROM basket_config 
    WHERE company_id = 1 AND is_active = 1
    ORDER BY target_page, display_order
");
while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    $linked = $row['linked_basket_key'] ? " -> {$row['linked_basket_key']}" : '';
    echo "  [{$row['target_page']}] {$row['basket_key']}: {$row['basket_name']}{$linked}\n";
}

echo "\n=== Sample assigned customer with basket key ===\n";
$stmt = $pdo->query("
    SELECT customer_id, first_name, last_name, assigned_to, current_basket_key 
    FROM customers 
    WHERE company_id = 1 AND assigned_to IS NOT NULL 
    LIMIT 5
");
while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    echo "  ID={$row['customer_id']}, {$row['first_name']}, assigned_to={$row['assigned_to']}, basket={$row['current_basket_key']}\n";
}
