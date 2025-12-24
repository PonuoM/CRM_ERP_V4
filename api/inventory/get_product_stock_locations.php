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
    $productId = isset($_GET['productId']) ? (int)$_GET['productId'] : 0;
    
    if (!$productId) {
        throw new Exception("Product ID required");
    }

    // Fetch Warehouses and Lots for this product
    // We want: Warehouse -> Lots inside it
    $sql = "SELECT 
                pl.id as lot_id,
                pl.lot_number,
                pl.quantity_remaining,
                pl.expiry_date as exp_date,
                pl.status,
                w.id as warehouse_id,
                w.name as warehouse_name
            FROM product_lots pl
            JOIN warehouses w ON pl.warehouse_id = w.id
            WHERE pl.product_id = ? AND pl.status = 'Active'
            ORDER BY w.name, pl.expiry_date ASC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute([$productId]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Group by Warehouse
    $warehouses = [];
    foreach ($rows as $row) {
        $wid = $row['warehouse_id'];
        if (!isset($warehouses[$wid])) {
            $warehouses[$wid] = [
                'id' => $wid,
                'name' => $row['warehouse_name'],
                'lots' => []
            ];
        }
        $warehouses[$wid]['lots'][] = [
            'id' => $row['lot_id'],
            'lot_number' => $row['lot_number'],
            'quantity' => $row['quantity_remaining'],
            'exp_date' => $row['exp_date']
        ];
    }

    echo json_encode([
        'success' => true,
        'data' => array_values($warehouses)
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
