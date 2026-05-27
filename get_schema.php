<?php
header('Content-Type: application/json; charset=utf-8');
$conn = new mysqli('127.0.0.1', 'root', '12345678', 'mini_erp');
$conn->set_charset("utf8mb4");

if ($conn->connect_error) {
    die(json_encode(["error" => "Connection failed: " . $conn->connect_error]));
}

$response = [];

// Get columns for orders
$res_orders = $conn->query("DESCRIBE orders");
$orders_columns = [];
while ($row = $res_orders->fetch_assoc()) {
    $orders_columns[] = $row['Field'];
}
$response['orders_columns'] = $orders_columns;

// Get columns for users
$res_users = $conn->query("DESCRIBE users");
$users_columns = [];
if ($res_users) {
    while ($row = $res_users->fetch_assoc()) {
        $users_columns[] = $row['Field'];
    }
}
$response['users_columns'] = $users_columns;

echo json_encode($response, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
$conn->close();
