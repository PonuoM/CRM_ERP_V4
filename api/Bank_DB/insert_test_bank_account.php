<?php
header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

// Set UTF-8 encoding
mb_internal_encoding("UTF-8");
mb_http_output("UTF-8");

require_once "../config.php";

try {
    // Database connection using PDO with UTF-8
    $conn = db_connect();
    $conn->exec("SET NAMES utf8mb4");
    $conn->exec("SET CHARACTER SET utf8mb4");

    // Insert test bank accounts for company_id = 1
    $testAccounts = [
        [
            'company_id' => 1,
            'bank' => 'ธนาคารกรุงเทพ',
            'bank_number' => '123-456-7890'
        ],
        [
            'company_id' => 1,
            'bank' => 'ธนาคารไทยพาณิชย์',
            'bank_number' => '098-765-4321'
        ],
        [
            'company_id' => 1,
            'bank' => 'ธนาคารกสิกรไทย',
            'bank_number' => '456-123-7890'
        ]
    ];

    $sql = "INSERT INTO bank_account (company_id, bank, bank_number, is_active) VALUES (?, ?, ?, 1)";
    $stmt = $conn->prepare($sql);

    $insertedCount = 0;
    foreach ($testAccounts as $account) {
        $result = $stmt->execute([$account['company_id'], $account['bank'], $account['bank_number']]);
        if ($result) {
            $insertedCount++;
        }
    }

    echo json_encode([
        "success" => true,
        "message" => "Test bank accounts inserted successfully",
        "inserted_count" => $insertedCount
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

} catch (Exception $e) {
    echo json_encode([
        "success" => false,
        "message" => $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}
?>
