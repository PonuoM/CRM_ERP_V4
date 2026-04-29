<?php
require 'config.php';
$pdo = db_connect();
$stmt = $pdo->query("DESCRIBE call_history");
$rows = $stmt->fetchAll();
header('Content-Type: application/json');
echo json_encode($rows);
