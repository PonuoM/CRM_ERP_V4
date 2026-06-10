<?php
require_once __DIR__ . '/config.php';
try {
    $pdo = db_connect();
    $stmt = $pdo->query("SELECT * FROM shopee_loyalty_orders");
    $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode($orders);
} catch (Exception $e) {
    echo $e->getMessage();
}
