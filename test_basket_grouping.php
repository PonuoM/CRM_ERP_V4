<?php
require_once 'api/config.php';

try {
    $pdo = db_connect();

    echo "=== Testing Basket Grouping Logic ===\n";

    // Get basket configs for dashboard_v2
    $stmt = $pdo->prepare('SELECT * FROM basket_config WHERE company_id = 1 AND target_page = "dashboard_v2" AND is_active = 1 ORDER BY display_order');
    $stmt->execute();
    $configs = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo "Basket configs loaded: " . count($configs) . "\n";

    // Get sample customers with their basket keys
    $stmt = $pdo->prepare('SELECT customer_id, first_name, last_name, current_basket_key FROM customers WHERE company_id = 1 AND assigned_to = 1 LIMIT 20');
    $stmt->execute();
    $customers = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo "Sample customers loaded: " . count($customers) . "\n\n";

    // Create mapping from ID to basket_key
    $idToBasketKeyMap = [];
    foreach ($configs as $config) {
        $idToBasketKeyMap[$config['id']] = $config['basket_key'];
    }

    echo "=== Simulating grouping logic ===\n";
    $groups = [];

    // Initialize groups
    foreach ($configs as $config) {
        $groups[$config['basket_key']] = [];
    }

    foreach ($customers as $customer) {
        $currentBasketKey = $customer['current_basket_key'];
        $matched = false;

        if ($currentBasketKey !== null) {
            $resolvedBasketKey = null;

            // Check if it's a number
            if (is_numeric($currentBasketKey)) {
                $basketId = (int)$currentBasketKey;
                $resolvedBasketKey = $idToBasketKeyMap[$basketId] ?? null;
                echo "Customer {$customer['customer_id']}: ID $currentBasketKey -> resolved to '$resolvedBasketKey'\n";
            } else {
                $resolvedBasketKey = $currentBasketKey;
                echo "Customer {$customer['customer_id']}: String key '$currentBasketKey'\n";
            }

            if ($resolvedBasketKey && isset($groups[$resolvedBasketKey])) {
                $groups[$resolvedBasketKey][] = $customer;
                $matched = true;
                echo "  -> Assigned to basket: $resolvedBasketKey\n";
            }
        }

        if (!$matched) {
            echo "  -> No match, would use rule-based fallback\n";
        }
        echo "\n";
    }

    // Show group counts
    echo "=== Final Group Counts ===\n";
    foreach ($groups as $basketKey => $customersInGroup) {
        echo "$basketKey: " . count($customersInGroup) . " customers\n";
    }

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
?>

