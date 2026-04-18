<?php
// API to reprocess pending dispatch items (stock_deducted = 0)
// Usually called after a new warehouse mapping is added.
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

require_once __DIR__ . '/../config.php';
$pdo = db_connect();

try {
    $input = json_decode(file_get_contents('php://input'), true);
    $companyId = $input['company_id'] ?? 1;
    $userId = $input['user_id'] ?? 1;
    $targetDispatchName = $input['dispatch_warehouse_name'] ?? null; // Optional: restrict to specific name

    $pdo->beginTransaction();

    // Find mappings
    $mappings = [];
    $stmtMap = $pdo->prepare("SELECT dispatch_warehouse_name, main_warehouse_id FROM inv2_warehouse_mappings WHERE company_id = ?");
    $stmtMap->execute([$companyId]);
    foreach ($stmtMap->fetchAll(PDO::FETCH_ASSOC) as $m) {
        $mappings[$m['dispatch_warehouse_name']] = $m['main_warehouse_id'];
    }

    // Find pending items
    $sqlPending = "SELECT i.id, i.product_sku, i.product_id, i.warehouse_name, i.quantity, i.batch_id, i.internal_order_id, i.variant_code 
                   FROM inv2_dispatch_items i
                   JOIN inv2_dispatch_batches b ON i.batch_id = b.id
                   WHERE b.company_id = ? AND i.stock_deducted = 0";
    $params = [$companyId];
    if ($targetDispatchName) {
        $sqlPending .= " AND i.warehouse_name = ?";
        $params[] = $targetDispatchName;
    }
    $sqlPending .= " ORDER BY i.id ASC";

    $stmtPending = $pdo->prepare($sqlPending);
    $stmtPending->execute($params);
    $pendingItems = $stmtPending->fetchAll(PDO::FETCH_ASSOC);

    $processedCount = 0;
    
    // Fetch batches info for movement references
    $batches = [];
    
    foreach ($pendingItems as $item) {
        $warehouseName = $item['warehouse_name'];
        $targetWarehouseId = $mappings[$warehouseName] ?? null;
        
        if (!$targetWarehouseId) continue;
        
        $productId = $item['product_id'];
        $qty = (float)$item['quantity'];
        
        if (!$productId || $qty <= 0) continue;
        
        if (!isset($batches[$item['batch_id']])) {
            $stmtB = $pdo->prepare("SELECT batch_doc_number FROM inv2_dispatch_batches WHERE id = ?");
            $stmtB->execute([$item['batch_id']]);
            $batches[$item['batch_id']] = $stmtB->fetchColumn();
        }
        $batchDocNumber = $batches[$item['batch_id']];

        // Deduct logic (FIFO)
        $remaining = $qty;
        $deductions = [];

        // Fetch lots
        $stmtStock = $pdo->prepare("SELECT id, lot_number, variant, quantity 
                                    FROM inv2_stock 
                                    WHERE product_id = ? AND warehouse_id = ? 
                                    ORDER BY quantity < 0 ASC, created_at ASC");
        $stmtStock->execute([$productId, $targetWarehouseId]);
        $lots = $stmtStock->fetchAll(PDO::FETCH_ASSOC);

        if (empty($lots)) {
            // No lot exists, create a NEGATIVE default lot
            $defaultLot = "SYS-OVERDRAW";
            $pdo->prepare("INSERT INTO inv2_stock (warehouse_id, product_id, lot_number, quantity, mfg_date, exp_date, unit_cost) VALUES (?, ?, ?, 0, NULL, NULL, 0)")
                ->execute([$targetWarehouseId, $productId, $defaultLot]);
            $newStockId = $pdo->lastInsertId();
            $deductions[] = [
                'stock_id' => $newStockId,
                'lot_number' => $defaultLot,
                'variant' => null,
                'quantity' => $remaining
            ];
        } else {
            $lastLotIndex = count($lots) - 1;
            foreach ($lots as $i => $lot) {
                if ($remaining <= 0) break;

                $deductQty = 0;
                if ($i === $lastLotIndex) {
                    // Last lot takes all the remaining deficit, driving it negative if necessary
                    $deductQty = $remaining;
                } else {
                    $available = (float)$lot['quantity'];
                    if ($available <= 0) $available = 0;
                    $deductQty = min($remaining, $available);
                }

                if ($deductQty > 0) {
                    $deductions[] = [
                        'stock_id' => $lot['id'],
                        'lot_number' => $lot['lot_number'],
                        'variant' => $lot['variant'] ?? null,
                        'quantity' => $deductQty
                    ];
                    $remaining -= $deductQty;
                }
            }
        }

        // Apply deductions
        foreach ($deductions as $ded) {
            $pdo->prepare("UPDATE inv2_stock SET quantity = quantity - ? WHERE id = ?")
                ->execute([$ded['quantity'], $ded['stock_id']]);

            $pdo->prepare("INSERT INTO inv2_movements (warehouse_id, product_id, variant, lot_number, movement_type, quantity, reference_type, reference_doc_number, reference_order_id, notes, created_by, company_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
                ->execute([$targetWarehouseId, $productId, $ded['variant'] ?? null, $ded['lot_number'], 'OUT', $ded['quantity'], 'dispatch (retroactive)', $batchDocNumber, $item['internal_order_id'], 'Auto-processed after mapping', $userId, $companyId]);
        }
        
        // Update item status
        $pdo->prepare("UPDATE inv2_dispatch_items SET stock_deducted = 1, warehouse_id = ? WHERE id = ?")
            ->execute([$targetWarehouseId, $item['id']]);
            
        $processedCount++;
    }

    $pdo->commit();

    echo json_encode(['success' => true, 'processed' => $processedCount]);
} catch (Exception $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
