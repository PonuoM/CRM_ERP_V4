<?php
header("Access-Control-Allow-Origin: *");
header('Content-Type: application/json');

require_once __DIR__ . '/../config.php';
$pdo = db_connect();

$results = [];

try {
    $pdo->beginTransaction();

    // 1. Find all distinct Lots in Warehouse Stocks
    // Group by product, warehouse, lot_number to verify existence
    $stmt = $pdo->query("
        SELECT 
            ws.product_id, 
            ws.warehouse_id, 
            ws.lot_number, 
            SUM(ws.quantity) as total_qty
        FROM warehouse_stocks ws
        WHERE ws.lot_number IS NOT NULL 
          AND ws.lot_number != ''
        GROUP BY ws.product_id, ws.warehouse_id, ws.lot_number
    ");
    
    $stocks = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $count = 0;

    foreach ($stocks as $stock) {
        $pid = $stock['product_id'];
        $wid = $stock['warehouse_id'];
        $lot = $stock['lot_number'];
        $qty = $stock['total_qty'];

        // Check if exists in product_lots
        $check = $pdo->prepare("SELECT id FROM product_lots WHERE product_id = ? AND warehouse_id = ? AND lot_number = ?");
        $check->execute([$pid, $wid, $lot]);
        
        if (!$check->fetch()) {
            // Missing! Create it.
            // We assume cost 0 and no expiry since generic sync.
            $insert = $pdo->prepare("INSERT INTO product_lots (product_id, lot_number, warehouse_id, quantity_remaining, quantity_received, status, created_at) VALUES (?, ?, ?, ?, ?, 'Active', NOW())");
            $insert->execute([$pid, $lot, $wid, $qty, $qty]);
            $count++;
            $results[] = "Created Lot: $lot for Product $pid at Warehouse $wid (Qty: $qty)";
            
            // Also update the warehouse_stock entry to link to this new lot?
            // warehouse_stocks has product_lot_id. It should be updated to maintain referential integrity.
            $newLotId = $pdo->lastInsertId();
            $updateWs = $pdo->prepare("UPDATE warehouse_stocks SET product_lot_id = ? WHERE product_id = ? AND warehouse_id = ? AND lot_number = ?");
            $updateWs->execute([$newLotId, $pid, $wid, $lot]);
        }
    }

    $pdo->commit();
    echo json_encode(['success' => true, 'created_count' => $count, 'details' => $results]);

} catch (Exception $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
