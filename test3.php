<?php
require 'api/config.php';
$pdo = db_connect();
$stmt = $pdo->query('DESCRIBE customers');
print_r($stmt->fetchAll());
