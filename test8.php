<?php
require 'api/config.php';
$pdo = db_connect();
$stmt = $pdo->query("SELECT basket_key, target_page, linked_basket_key FROM basket_config WHERE company_id = 1");
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
