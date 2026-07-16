<?php
require 'api/config.php';
$pdo = db_connect();
$stmt = $pdo->query('SELECT current_basket_key, COUNT(*) FROM customers GROUP BY current_basket_key');
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
