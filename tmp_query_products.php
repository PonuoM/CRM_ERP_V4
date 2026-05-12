<?php
header('Content-Type: text/plain; charset=utf-8');
ini_set('display_errors', 1);
error_reporting(E_ALL);

$conn = new mysqli('202.183.192.218', 'primacom_bloguser', 'pJnL53Wkhju2LaGPytw8', 'primacom_mini_erp');
if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}
$conn->set_charset("utf8mb4");

echo "=== Query products ===\n";
$result = $conn->query("SHOW TABLES LIKE 'products'");
if (!$result) {
    echo "Error: " . $conn->error . "\n";
} else {
    while ($row = $result->fetch_assoc()) {
        print_r($row);
    }
}

$result2 = $conn->query("SELECT * FROM products LIMIT 1");
if (!$result2) {
    echo "Error 2: " . $conn->error . "\n";
} else {
    while ($row = $result2->fetch_assoc()) {
        print_r($row);
    }
}

$conn->close();
?>
