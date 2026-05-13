<?php
require_once __DIR__ . '/config.php';
header('Content-Type: text/plain');

$pdo = db_connect();
$customerId = 333919;

$stmt = $pdo->prepare("SELECT customer_id, first_name, last_name, assigned_to, current_basket_key, basket_entered_date, last_order_date FROM customers WHERE customer_id = ?");
$stmt->execute([$customerId]);
$cust = $stmt->fetch(PDO::FETCH_ASSOC);

echo "Customer Data:\n";
print_r($cust);

if ($cust) {
    echo "\nDATEDIFF(NOW(), basket_entered_date): ";
    $d1 = $pdo->query("SELECT DATEDIFF(NOW(), '{$cust['basket_entered_date']}')")->fetchColumn();
    echo $d1 . "\n";
    
    echo "DATEDIFF(NOW(), last_order_date): ";
    if ($cust['last_order_date']) {
        $d2 = $pdo->query("SELECT DATEDIFF(NOW(), '{$cust['last_order_date']}')")->fetchColumn();
        echo $d2 . "\n";
    } else {
        echo "NULL (because last_order_date is NULL)\n";
    }
    
    $stmt3 = $pdo->prepare("SELECT basket_key, basket_name, fail_after_days, extend_days_per_appointment, max_total_days FROM basket_config WHERE id = ?");
    $stmt3->execute([$cust['current_basket_key']]);
    echo "\nBasket Config:\n";
    print_r($stmt3->fetch(PDO::FETCH_ASSOC));
    
    $stmt4 = $pdo->prepare("SELECT COUNT(*) FROM appointments WHERE customer_id = ? AND date >= ?");
    $stmt4->execute([$customerId, $cust['basket_entered_date']]);
    echo "\nValid Appointments: " . $stmt4->fetchColumn() . "\n";
}
