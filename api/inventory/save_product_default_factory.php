<?php
// ตั้งโรงงานเริ่มต้นของสินค้า (เช่น ปุ๋ยอินทรีย์ -> การ 3) — ตอนเปิด SO ระบบจะเลือกให้อัตโนมัติ
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once '../config.php';
require_once 'production_permission.php';
$pdo = db_connect();

try {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!is_array($input)) {
        throw new Exception('Invalid input');
    }

    $userId = $input['user_id'] ?? null;
    production_require_manage($pdo, $userId);

    $productId = (int)($input['product_id'] ?? 0);
    $factoryId = isset($input['factory_id']) ? (int)$input['factory_id'] : 0;

    if ($productId <= 0) {
        throw new Exception('Missing product id');
    }

    $stmt = $pdo->prepare('UPDATE stock_arrival_products SET default_factory_id = ? WHERE id = ?');
    $stmt->execute([$factoryId > 0 ? $factoryId : null, $productId]);

    echo json_encode(['success' => true]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
