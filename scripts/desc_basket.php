<?php
require 'api/config.php';
$pdo = db_connect();
$stmt = $pdo->query('DESCRIBE basket_config');
$columns = $stmt->fetchAll(PDO::FETCH_ASSOC);
foreach ($columns as $c) {
    echo $c['Field'] . ' | ' . $c['Type'] . "\n";
}
