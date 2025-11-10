<?php
header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

// Set UTF-8 encoding
mb_internal_encoding("UTF-8");
mb_http_output("UTF-8");

require_once "../config.php";

// Get JSON input
$json_input = file_get_contents('php://input');
$data = json_decode($json_input, true);

if (!$data) {
    echo json_encode([
        "success" => false,
        "message" => "Invalid JSON data",
    ]);
    exit();
}

// Validate required fields
$required_fields = ['order_id', 'amount', 'bank_account_id', 'transfer_date', 'url'];
foreach ($required_fields as $field) {
    if (empty($data[$field])) {
        echo json_encode([
            "success" => false,
            "message" => "Field '$field' is required",
        ]);
        exit();
    }
}

try {
    // Database connection using PDO with UTF-8
    $conn = db_connect();
    $conn->exec("SET NAMES utf8mb4");
    $conn->exec("SET CHARACTER SET utf8mb4");

    // Validate if order exists and belongs to company
    $order_id = $data['order_id'];
    $company_id = $data['company_id'] ?? 0;

    $order_check_sql = "SELECT id, company_id FROM orders WHERE id = ?";
    $order_stmt = $conn->prepare($order_check_sql);
    $order_stmt->execute([$order_id]);
    $order = $order_stmt->fetch();

    if (!$order) {
        echo json_encode([
            "success" => false,
            "message" => "Order not found",
        ]);
        exit();
    }

    // Verify company_id matches
    if ($order['company_id'] != $company_id) {
        echo json_encode([
            "success" => false,
            "message" => "Company ID mismatch",
        ]);
        exit();
    }

    // Validate bank account exists and belongs to company
    $bank_account_id = $data['bank_account_id'];
    $bank_check_sql = "SELECT id FROM bank_account WHERE id = ? AND company_id = ? AND is_active = 1 AND deleted_at IS NULL";
    $bank_stmt = $conn->prepare($bank_check_sql);
    $bank_stmt->execute([$bank_account_id, $company_id]);
    $bank_account = $bank_stmt->fetch();

    if (!$bank_account) {
        echo json_encode([
            "success" => false,
            "message" => "Bank account not found or inactive",
        ]);
        exit();
    }

    // Check if slip already exists for this order
    $existing_slip_sql = "SELECT id FROM order_slips WHERE order_id = ?";
    $existing_stmt = $conn->prepare($existing_slip_sql);
    $existing_stmt->execute([$order_id]);
    $existing_slip = $existing_stmt->fetch();

    if ($existing_slip) {
        echo json_encode([
            "success" => false,
            "message" => "Slip already exists for this order",
        ]);
        exit();
    }

    // Insert new order slip
    $amount = (int) $data['amount'];
    $transfer_date = $data['transfer_date'];
    $url = $data['url'];

    $insert_sql = "INSERT INTO order_slips (order_id, amount, bank_account_id, transfer_date, url)
                   VALUES (?, ?, ?, ?, ?)";

    $insert_stmt = $conn->prepare($insert_sql);
    $result = $insert_stmt->execute([$order_id, $amount, $bank_account_id, $transfer_date, $url]);

    if ($result) {
        $slip_id = $conn->lastInsertId();
        echo json_encode([
            "success" => true,
            "message" => "Order slip added successfully",
            "data" => [
                "id" => $slip_id,
                "order_id" => $order_id,
                "amount" => $amount,
                "bank_account_id" => $bank_account_id,
                "transfer_date" => $transfer_date,
                "url" => $url,
            ]
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    } else {
        echo json_encode([
            "success" => false,
            "message" => "Failed to insert order slip",
        ]);
    }

} catch (Exception $e) {
    echo json_encode([
        "success" => false,
        "message" => $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}
?>
