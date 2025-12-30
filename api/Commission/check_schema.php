<?php
require_once __DIR__ . "/../config.php";
try {
    $pdo = db_connect();
    $stmt = $pdo->query("SHOW CREATE TABLE order_items");
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    echo $row['Create Table'] ?? print_r($row, true);
} catch (Exception $e) {
    echo $e->getMessage();
}
