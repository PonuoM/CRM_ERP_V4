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
    $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
    if (!$id) {
        throw new Exception("Transaction ID required");
    }

    // 1. Fetch Header
    $sql = "SELECT st.*, u.username as created_by_name 
            FROM stock_transactions st
            LEFT JOIN users u ON st.created_by = u.id
            WHERE st.id = ?";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$id]);
    $transaction = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$transaction) {
        throw new Exception("Transaction not found");
    }

    // 2. Fetch Items
    $sqlItems = "SELECT sti.*, 
                 p.sku as product_code, p.name as product_name, 
                 w.name as warehouse_name,
                 l.lot_number, l.quantity_remaining as lot_balance
                 FROM stock_transaction_items sti
                 LEFT JOIN products p ON sti.product_id = p.id
                 LEFT JOIN warehouses w ON sti.warehouse_id = w.id
                 LEFT JOIN product_lots l ON sti.lot_id = l.id
                 WHERE sti.transaction_id = ?";
    $stmtItems = $pdo->prepare($sqlItems);
    $stmtItems->execute([$id]);
    $items = $stmtItems->fetchAll(PDO::FETCH_ASSOC);

    // 3. Fetch Images
    $sqlImg = "SELECT id, image_path FROM stock_transaction_images WHERE transaction_id = ?";
    $stmtImg = $pdo->prepare($sqlImg);
    $stmtImg->execute([$id]);
    $images = $stmtImg->fetchAll(PDO::FETCH_ASSOC);

    // Filter image paths to full URL if needed, currently storing relative path 'uploads/proofs/...'
    // API consumer should prepend base URL if needed, or we do it here.
    // Let's prepend generic API base if relative
    foreach ($images as &$img) {
         // Assuming client handles base URL, but for base64 re-display in edit helper:
         // The client expects 'images' to be an array of strings (urls).
         // But here we return objects. Client adapter will handle.
    }

    echo json_encode([
        'success' => true,
        'data' => [
            'header' => $transaction,
            'items' => $items,
            'images' => $images
        ]
    ]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
