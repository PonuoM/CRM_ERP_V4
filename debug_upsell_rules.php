<?php
require_once 'api/config.php';

try {
    $pdo = db_connect();

    echo "=== Testing Upsell Rules ===\n";

    // Get upsell config
    $stmt = $pdo->prepare('SELECT * FROM basket_config WHERE basket_key = "upsell" AND company_id = 1');
    $stmt->execute();
    $upsellConfig = $stmt->fetch(PDO::FETCH_ASSOC);

    echo "Upsell config:\n";
    print_r($upsellConfig);

    echo "\n=== Testing rules against sample customers ===\n";

    // Get sample customers that are assigned to user 1
    $stmt = $pdo->prepare('SELECT c.customer_id, c.first_name, c.last_name, c.current_basket_key,
                           c.date_registered, c.first_order_date,
                           COALESCE(os.order_count, 0) as order_count,
                           DATEDIFF(CURDATE(), os.last_order_date) as days_since_order,
                           DATEDIFF(CURDATE(), c.date_registered) as days_since_registered
                           FROM customers c
                           LEFT JOIN (
                               SELECT customer_id, COUNT(*) as order_count, MAX(order_date) as last_order_date, MIN(order_date) as first_order_date
                               FROM orders WHERE order_status != "Cancelled" GROUP BY customer_id
                           ) os ON c.customer_id = os.customer_id
                           WHERE c.company_id = 1 AND c.assigned_to = 1
                           LIMIT 10');
    $stmt->execute();
    $customers = $stmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($customers as $customer) {
        echo "\nCustomer: {$customer['first_name']} {$customer['last_name']} (ID: {$customer['customer_id']})\n";
        echo "  current_basket_key: {$customer['current_basket_key']}\n";
        echo "  order_count: {$customer['order_count']}\n";
        echo "  days_since_order: " . ($customer['days_since_order'] ?: 'NULL') . "\n";
        echo "  days_since_registered: " . ($customer['days_since_registered'] ?: 'NULL') . "\n";

        // Test upsell rules (all NULL = matches everything)
        $matches = true;

        if ($upsellConfig['min_order_count'] !== null) {
            $matches = $matches && ($customer['order_count'] >= $upsellConfig['min_order_count']);
            echo "  min_order_count check: {$customer['order_count']} >= {$upsellConfig['min_order_count']} = " . ($customer['order_count'] >= $upsellConfig['min_order_count'] ? 'PASS' : 'FAIL') . "\n";
        }

        if ($upsellConfig['max_order_count'] !== null) {
            $matches = $matches && ($customer['order_count'] <= $upsellConfig['max_order_count']);
            echo "  max_order_count check: {$customer['order_count']} <= {$upsellConfig['max_order_count']} = " . ($customer['order_count'] <= $upsellConfig['max_order_count'] ? 'PASS' : 'FAIL') . "\n";
        }

        if ($upsellConfig['days_since_registered'] !== null && $customer['days_since_registered'] !== null) {
            $matches = $matches && ($customer['days_since_registered'] <= $upsellConfig['days_since_registered']);
            echo "  days_since_registered check: {$customer['days_since_registered']} <= {$upsellConfig['days_since_registered']} = " . ($customer['days_since_registered'] <= $upsellConfig['days_since_registered'] ? 'PASS' : 'FAIL') . "\n";
        }

        echo "  Final result: " . ($matches ? 'MATCHES UPSELL' : 'DOES NOT MATCH UPSELL') . "\n";
    }

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
?>

