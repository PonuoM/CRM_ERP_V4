<?php
$conn = new mysqli('202.183.192.218', 'primacom_bloguser', 'pJnL53Wkhju2LaGPytw8', 'primacom_mini_erp');
$conn->set_charset("utf8mb4");
$conn->query("UPDATE orders SET payment_status = 'Unpaid', order_status = 'Shipping' WHERE id = '260319-01145angxh'");
echo 'affected: ' . $conn->affected_rows;
$conn->close();
?>
