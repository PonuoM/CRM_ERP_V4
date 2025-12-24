<?php
header("Access-Control-Allow-Origin: *");
header('Content-Type: application/json');

require_once __DIR__ . '/../config.php';
$pdo = db_connect();

$logs = [];

try {
    // 1. Fix Schema (Drop strict unique on lot_number if exists)
    // We check if index exists first or just try to drop/add
    try {
        $pdo->exec("ALTER TABLE product_lots DROP INDEX lot_number");
        $logs[] = "Dropped old index 'lot_number'.";
    } catch (Exception $e) {
        $logs[] = "Index 'lot_number' might not exist or verify failed: " . $e->getMessage();
    }

    try {
        // Add correct composite index
        $pdo->exec("CREATE UNIQUE INDEX idx_product_lot_unique ON product_lots (product_id, lot_number)");
        $logs[] = "Created new composite index 'idx_product_lot_unique'.";
    } catch (Exception $e) {
        $logs[] = "Composite index might already exist: " . $e->getMessage();
    }
    
    // 2. Sync Logic
    $pdo->beginTransaction();

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
            $insert = $pdo->prepare("INSERT INTO product_lots (product_id, lot_number, warehouse_id, quantity_remaining, quantity_received, status, created_at) VALUES (?, ?, ?, ?, ?, 'Active', NOW())");
            $insert->execute([$pid, $lot, $wid, $qty, $qty]);
            $count++;
            $logs[] = "Created Lot: $lot for Product $pid at Warehouse $wid";
            
            $newLotId = $pdo->lastInsertId();
            $updateWs = $pdo->prepare("UPDATE warehouse_stocks SET product_lot_id = ? WHERE product_id = ? AND warehouse_id = ? AND lot_number = ?");
            $updateWs->execute([$newLotId, $pid, $wid, $lot]);
        }
    }

    $pdo->commit();
    echo json_encode(['success' => true, 'count' => $count, 'logs' => $logs]);

} catch (Exception $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    echo json_encode(['success' => false, 'error' => $e->getMessage(), 'logs' => $logs]);
}
