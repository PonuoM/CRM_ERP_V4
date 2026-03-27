<?php
$conn = new mysqli('202.183.192.218', 'primacom_bloguser', 'pJnL53Wkhju2LaGPytw8', 'primacom_mini_erp');
$conn->set_charset("utf8mb4");
$r = $conn->query("SHOW COLUMNS FROM users");
while($c=$r->fetch_assoc()) echo $c['Field'] . " (" . $c['Type'] . ")\n";
echo "\n--- call_history columns ---\n";
$r2 = $conn->query("SHOW COLUMNS FROM call_history");
while($c2=$r2->fetch_assoc()) echo $c2['Field'] . " (" . $c2['Type'] . ")\n";
echo "\n--- customer_logs columns ---\n";
$r3 = $conn->query("SHOW COLUMNS FROM customer_logs");
while($c3=$r3->fetch_assoc()) echo $c3['Field'] . " (" . $c3['Type'] . ")\n";
echo "\n--- appointments columns ---\n";
$r4 = $conn->query("SHOW COLUMNS FROM appointments");
while($c4=$r4->fetch_assoc()) echo $c4['Field'] . " (" . $c4['Type'] . ")\n";
echo "\n--- orders columns ---\n";
$r5 = $conn->query("SHOW COLUMNS FROM orders");
while($c5=$r5->fetch_assoc()) echo $c5['Field'] . " (" . $c5['Type'] . ")\n";
$conn->close();
