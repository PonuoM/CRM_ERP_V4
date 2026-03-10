<?php
/**
 * get_return_images.php
 * ดึงรูปพัสดุตีกลับตาม sub_order_id
 * Method: GET
 * Params: sub_order_id (required)
 */

require_once __DIR__ . '/../config.php';
cors();
$pdo = db_connect();

header('Content-Type: application/json; charset=utf-8');

$subOrderId = $_GET['sub_order_id'] ?? '';
if (!$subOrderId) {
    echo json_encode(['status' => 'error', 'message' => 'sub_order_id is required']);
    exit();
}

try {
    $stmt = $pdo->prepare("SELECT id, sub_order_id, filename, url, created_at FROM return_images WHERE sub_order_id = ? ORDER BY created_at DESC");
    $stmt->execute([$subOrderId]);
    $images = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'status' => 'success',
        'images' => $images,
    ]);
} catch (Exception $e) {
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
