<?php
require_once 'api/config.php';

try {
    $pdo = db_connect();

    echo "=== Basket Configs for dashboard_v2 ===\n";
    $stmt = $pdo->prepare('SELECT basket_key, basket_name, linked_basket_key FROM basket_config WHERE company_id = 1 AND target_page = "dashboard_v2" AND is_active = 1 ORDER BY display_order');
    $stmt->execute();
    $configs = $stmt->fetchAll(PDO::FETCH_ASSOC);
    print_r($configs);

    echo "\n=== Sample Customer current_basket_key values ===\n";
    $stmt2 = $pdo->prepare('SELECT DISTINCT current_basket_key, COUNT(*) as count FROM customers WHERE company_id = 1 AND current_basket_key IS NOT NULL GROUP BY current_basket_key LIMIT 10');
    $stmt2->execute();
    $basketKeys = $stmt2->fetchAll(PDO::FETCH_ASSOC);
    print_r($basketKeys);

    echo "\n=== Total customers with current_basket_key ===\n";
    $stmt3 = $pdo->prepare('SELECT COUNT(*) as total FROM customers WHERE company_id = 1 AND current_basket_key IS NOT NULL');
    $stmt3->execute();
    $total = $stmt3->fetch(PDO::FETCH_ASSOC);
    echo "Total customers with basket key: " . $total['total'] . "\n";

    echo "\n=== Upsell Basket Config Details ===\n";
    $stmt4 = $pdo->prepare('SELECT * FROM basket_config WHERE basket_key = "upsell" AND company_id = 1');
    $stmt4->execute();
    $upsellConfig = $stmt4->fetch(PDO::FETCH_ASSOC);
    print_r($upsellConfig);

    echo "\n=== Total customers in company ===\n";
    $stmt5 = $pdo->prepare('SELECT COUNT(*) as total FROM customers WHERE company_id = 1');
    $stmt5->execute();
    $total = $stmt5->fetch(PDO::FETCH_ASSOC);
    echo "Total customers: " . $total['total'] . "\n";

    echo "\n=== Sample customers with their current_basket_key ===\n";
    $stmt6 = $pdo->prepare('SELECT customer_id, first_name, last_name, current_basket_key FROM customers WHERE company_id = 1 AND assigned_to = ? LIMIT 10');
    $stmt6->execute([1]); // Assuming user ID 1
    $sampleCustomers = $stmt6->fetchAll(PDO::FETCH_ASSOC);
    print_r($sampleCustomers);

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
?>
