<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once '../config.php';
$pdo = db_connect();

try {
    // default_factory_id ใช้เฉพาะเมนู "สั่งผลิต & ใบขน" (โรงงานเริ่มต้นของสินค้า)
    $stmt = $pdo->query("SELECT id, sku, name, format_code, default_factory_id FROM stock_arrival_products WHERE is_active = 1 ORDER BY name ASC");
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $data = array_map(function ($row) {
        return [
            'id' => (int)$row['id'],
            'sku' => $row['sku'],
            'name' => $row['name'],
            'format_code' => $row['format_code'],
            'default_factory_id' => $row['default_factory_id'] !== null ? (int)$row['default_factory_id'] : null,
        ];
    }, $rows);

    echo json_encode(['success' => true, 'data' => $data]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
