<?php
require_once 'api/config.php';

try {
    $pdo = db_connect();

    echo "=== Checking distribution of current_basket_key values ===\n";
    $stmt = $pdo->prepare('SELECT current_basket_key, COUNT(*) as count FROM customers WHERE company_id = 1 AND assigned_to IS NOT NULL AND assigned_to != 0 GROUP BY current_basket_key ORDER BY count DESC LIMIT 10');
    $stmt->execute();
    $distribution = $stmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($distribution as $row) {
        // Map ID to basket name
        $basketId = $row['current_basket_key'];
        $stmt2 = $pdo->prepare('SELECT basket_name FROM basket_config WHERE id = ?');
        $stmt2->execute([$basketId]);
        $config = $stmt2->fetch(PDO::FETCH_ASSOC);
        $basketName = $config ? $config['basket_name'] : 'Unknown';
        echo "Basket ID {$basketId} ({$basketName}): {$row['count']} customers\n";
    }

    echo "\n=== Checking if user has customers in basket 50 ===\n";
    $stmt3 = $pdo->prepare('SELECT COUNT(*) as count FROM customers WHERE company_id = 1 AND assigned_to = 1 AND current_basket_key = 50');
    $stmt3->execute();
    $count = $stmt3->fetch(PDO::FETCH_ASSOC);
    echo "User 1 has {$count['count']} customers in basket 50\n";

    echo "\n=== Sample customers in basket 50 for user 1 ===\n";
    $stmt4 = $pdo->prepare('SELECT customer_id, first_name, last_name FROM customers WHERE company_id = 1 AND assigned_to = 1 AND current_basket_key = 50 LIMIT 5');
    $stmt4->execute();
    $samples = $stmt4->fetchAll(PDO::FETCH_ASSOC);
    print_r($samples);

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
?>

