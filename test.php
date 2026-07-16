<?php
require 'api/config.php';
$pdo = db_connect();
$stmt = $pdo->query('SELECT id, distribution_mode, total_customers, created_at, session_tag FROM distribution_sessions ORDER BY id DESC LIMIT 5');
$sessions = $stmt->fetchAll();
print_r($sessions);
