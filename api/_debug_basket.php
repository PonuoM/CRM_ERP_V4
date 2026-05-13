<?php
require_once __DIR__ . '/config.php';
$pdo = db_connect();
$stmt = $pdo->query("SELECT id, basket_key, basket_name, fail_after_days FROM basket_config LIMIT 10");
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
