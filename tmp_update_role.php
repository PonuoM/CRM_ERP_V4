<?php
$conn = new mysqli('202.183.192.218', 'primacom_bloguser', 'pJnL53Wkhju2LaGPytw8', 'primacom_mini_erp');
$conn->set_charset("utf8mb4");
$conn->query("UPDATE users SET role_id = 5 WHERE id = 1711");
echo 'affected: ' . $conn->affected_rows;
$conn->close();
?>
