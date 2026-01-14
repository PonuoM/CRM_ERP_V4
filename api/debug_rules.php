<?php
require_once 'config.php';
$pdo = db_connect();
$stmt = $pdo->prepare("SELECT * FROM order_tab_rules WHERE tab_key = 'waitingExport'");
$stmt->execute();
$rules = $stmt->fetchAll(PDO::FETCH_ASSOC);
header('Content-Type: application/json');
echo json_encode($rules, JSON_PRETTY_PRINT);
?>
 