<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once '../config.php';
$pdo = db_connect();

try {
    $input = json_decode(file_get_contents('php://input'), true);
    $date = trim($input['holiday_date'] ?? '');
    $label = trim($input['label'] ?? '') ?: null;
    $userId = $input['user_id'] ?? null;

    if ($date === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
        throw new Exception('กรุณาระบุวันที่ให้ถูกต้อง');
    }

    // Same date saved twice just updates the label
    $stmt = $pdo->prepare("INSERT INTO stock_arrival_factory_holidays (holiday_date, label, created_by)
                            VALUES (?, ?, ?)
                            ON DUPLICATE KEY UPDATE label = VALUES(label)");
    $stmt->execute([$date, $label, $userId]);

    echo json_encode(['success' => true]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
