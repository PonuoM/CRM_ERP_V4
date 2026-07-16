<?php
require 'api/config.php';
$pdo = db_connect();
$stmt = $pdo->query("SELECT b.basket_key, COUNT(*) FROM customers c JOIN basket_config b ON c.current_basket_key=b.id WHERE c.assigned_to IS NOT NULL AND c.assigned_to != 0 AND b.target_page='distribution' GROUP BY b.basket_key");
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
