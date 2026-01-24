<?php
require_once __DIR__ . '/../config.php';
$pdo = db_connect();

echo "=== basket_transition_log ===\n";
$stmt = $pdo->query("DESCRIBE basket_transition_log");
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));

echo "\n=== basket_return_log ===\n";
$stmt = $pdo->query("DESCRIBE basket_return_log");
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
