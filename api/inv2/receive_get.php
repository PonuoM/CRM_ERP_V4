<?php
// Receive Get API — Return detail items for a specific receive document
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

require_once __DIR__ . '/../config.php';
$pdo = db_connect();

try {
    $docId = $_GET['doc_id'] ?? null;
    if (!$docId) throw new Exception('doc_id required');

    // Check which columns exist in inv2_stock_orders to avoid SQL errors
    $soCols = '';
    try {
        $colCheck = $pdo->query("SHOW COLUMNS FROM inv2_stock_orders LIKE 'source_location'");
        if ($colCheck->fetch()) {
            $soCols = ', so.source_location, so.customer_vendor, so.delivery_location';
        }
    } catch (Exception $e) { /* columns don't exist yet */ }

    // Get document header
    $stmt = $pdo->prepare("
        SELECT rd.*, w.name as warehouse_name, so.so_number $soCols,
               CONCAT(u.first_name, ' ', u.last_name) as created_by_name
        FROM inv2_receive_documents rd
        LEFT JOIN warehouses w ON rd.warehouse_id = w.id
        LEFT JOIN inv2_stock_orders so ON rd.stock_order_id = so.id
        LEFT JOIN users u ON rd.created_by = u.id
        WHERE rd.id = ?
    ");
    $stmt->execute([$docId]);
    $doc = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$doc) throw new Exception('Document not found');

    $doc['images'] = $doc['images'] ? json_decode($doc['images'], true) : [];

    // Check if inv2_stock_order_items has department/delivery_date
    $soiExtra = '';
    try {
        $colCheck = $pdo->query("SHOW COLUMNS FROM inv2_stock_order_items LIKE 'department'");
        if ($colCheck->fetch()) {
            $soiExtra = ', soi.department, soi.delivery_date as so_delivery_date';
        }
    } catch (Exception $e) { /* columns don't exist */ }

    // Get items with product info
    $stmt = $pdo->prepare("
        SELECT ri.*, p.name as product_name, p.sku as product_sku $soiExtra
        FROM inv2_receive_items ri
        LEFT JOIN products p ON ri.product_id = p.id
        LEFT JOIN inv2_stock_order_items soi ON ri.so_item_id = soi.id
        WHERE ri.receive_doc_id = ?
        ORDER BY ri.id ASC
    ");
    $stmt->execute([$docId]);
    $items = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'data' => [
            'document' => $doc,
            'items' => $items
        ]
    ]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
