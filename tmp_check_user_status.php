<?php
header('Content-Type: text/plain; charset=utf-8');
$conn = new mysqli('202.183.192.218', 'primacom_bloguser', 'pJnL53Wkhju2LaGPytw8', 'primacom_mini_erp');
$conn->set_charset("utf8mb4");

$res = $conn->query("SELECT DISTINCT status FROM users");
while($r = $res->fetch_assoc()) print_r($r);

$conn->close();
?>
