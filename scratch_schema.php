<?php
require __DIR__ . '/api/config.php';
$pdo = db_connect();
$stmt = $pdo->query("SHOW COLUMNS FROM customer_audit_log");
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
