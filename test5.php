<?php
require 'api/config.php';
$pdo = db_connect();
$stmt = $pdo->query('DESCRIBE distribution_sessions');
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
