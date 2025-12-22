<?php
require_once __DIR__ . '/config.php';
$pdo = db_connect();
$stmt = $pdo->query("DESCRIBE customers lifecycle_status");
print_r($stmt->fetch());
