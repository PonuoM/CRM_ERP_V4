<?php
$host = 'localhost';
$db   = 'primacom_mini_erp';
$user = 'primacom_bloguser';
$pass = 'MzBpsVmDmhg8afrxgaUg';
$charset = 'utf8mb4';

$dsn = "mysql:host=$host;dbname=$db;charset=$charset";
$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
    $pdo = new PDO($dsn, $user, $pass, $options);
    $stmt = $pdo->query("SHOW CREATE TABLE orders");
    $row = $stmt->fetch();
    echo $row['Create Table'];
} catch (\PDOException $e) {
    echo "Connection failed: " . $e->getMessage();
}
