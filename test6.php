<?php
require 'api/config.php';
$pdo = db_connect();
$stmt = $pdo->query('SELECT id, basket_key, basket_name, linked_basket_key FROM basket_config WHERE company_id = 1');
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
