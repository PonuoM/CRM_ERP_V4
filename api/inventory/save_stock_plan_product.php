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
    $sku = trim($input['sku'] ?? '');
    $name = trim($input['name'] ?? '');
    $formatCode = trim($input['format_code'] ?? '') ?: null;
    $userId = $input['user_id'] ?? null;

    if ($sku === '' || $name === '') {
        throw new Exception('กรุณาระบุรหัสสินค้าและชื่อสินค้า');
    }

    $chk = $pdo->prepare("SELECT id FROM stock_arrival_products WHERE sku = ?");
    $chk->execute([$sku]);
    if ($chk->fetchColumn()) {
        throw new Exception("รหัสสินค้า $sku มีอยู่ในระบบแล้ว");
    }

    $stmt = $pdo->prepare("INSERT INTO stock_arrival_products (sku, name, format_code, created_by) VALUES (?, ?, ?, ?)");
    $stmt->execute([$sku, $name, $formatCode, $userId]);

    echo json_encode(['success' => true, 'id' => (int)$pdo->lastInsertId()]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
