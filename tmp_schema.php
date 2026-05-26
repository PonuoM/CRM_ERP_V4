<?php
header('Content-Type: text/plain; charset=utf-8');
$conn = new mysqli('202.183.192.218', 'primacom_bloguser', 'pJnL53Wkhju2LaGPytw8', 'primacom_mini_erp');

echo "=== PRODUCTS ===\n";
$res = $conn->query("DESCRIBE products");
while($r = $res->fetch_assoc()) echo $r['Field'] . "\n";

echo "=== USERS ===\n";
$res = $conn->query("DESCRIBE users");
while($r = $res->fetch_assoc()) echo $r['Field'] . "\n";

$conn->close();
?>
