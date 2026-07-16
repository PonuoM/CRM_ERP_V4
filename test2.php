<?php
require 'api/config.php';
$pdo = db_connect();
$stmt = $pdo->query('SELECT * FROM distribution_sessions WHERE distribution_mode = "Bulk Reclaim" ORDER BY id DESC LIMIT 5');
$sessions = $stmt->fetchAll();
print_r($sessions);
