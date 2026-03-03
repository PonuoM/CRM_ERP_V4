<?php
// SO Get API — Get single Stock Order with items and remaining quantities
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

require_once __DIR__ . '/../config.php';
$pdo = db_connect();

try {
    $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
    if (!$id) throw new Exception("Stock Order ID required");

    // Header
    $stmt = $pdo->prepare("SELECT so.*, w.name as warehouse_name,
                                   CONCAT(u.first_name, ' ', u.last_name) as created_by_name
                            FROM inv2_stock_orders so
                            LEFT JOIN warehouses w ON so.warehouse_id = w.id
                            LEFT JOIN users u ON so.created_by = u.id
                            WHERE so.id = ?");
    $stmt->execute([$id]);
    $header = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$header) throw new Exception("Stock Order not found");

    $header['images'] = $header['images'] ? json_decode($header['images'], true) : [];

    // Items with remaining
    $stmt = $pdo->prepare("SELECT soi.*, p.name as product_name, p.sku as product_sku
                            FROM inv2_stock_order_items soi
                            LEFT JOIN products p ON soi.product_id = p.id
                            WHERE soi.stock_order_id = ?
                            ORDER BY soi.id");
    $stmt->execute([$id]);
    $items = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Calculate remaining for each item
    foreach ($items as &$item) {
        $item['remaining_quantity'] = (float)$item['quantity'] - (float)$item['received_quantity'];
    }

    echo json_encode([
        'success' => true,
        'data' => [
            'header' => $header,
            'items' => $items
        ]
    ]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
