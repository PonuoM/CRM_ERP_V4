<?php
// Dispatch Import API — Import CSV dispatch data, save batch + items, auto-FIFO deduct stock
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

require_once __DIR__ . '/../config.php';
$pdo = db_connect();

try {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input) throw new Exception('Invalid input');

    $userId = $input['user_id'] ?? 1;
    $companyId = $input['company_id'] ?? 1;
    $notes = $input['notes'] ?? null;
    $filename = $input['filename'] ?? 'unknown.csv';
    $rows = $input['rows'] ?? [];

    if (empty($rows)) throw new Exception('No dispatch rows provided');

    $pdo->beginTransaction();

    // Generate batch doc number: DSP-YYYYMMDD-XXXXX
    $datePart = date('Ymd');
    $existingBatches = $pdo->prepare("SELECT COUNT(*) FROM inv2_dispatch_batches WHERE batch_doc_number LIKE ?");
    $existingBatches->execute(["DSP-$datePart-%"]);
    $batchCount = (int)$existingBatches->fetchColumn();
    $batchDocNumber = "DSP-$datePart-" . str_pad($batchCount + 1, 5, '0', STR_PAD_LEFT);

    // Calculate totals
    $totalQty = 0;
    foreach ($rows as $r) { $totalQty += (float)($r['quantity'] ?? 0); }

    // Insert batch record
    $pdo->prepare("INSERT INTO inv2_dispatch_batches (batch_doc_number, filename, total_rows, total_quantity, notes, created_by, company_id) VALUES (?,?,?,?,?,?,?)")
        ->execute([$batchDocNumber, $filename, count($rows), $totalQty, $notes, $userId, $companyId]);
    $batchId = (int)$pdo->lastInsertId();

    $results = [];
    $errors = [];
    $processedCount = 0;

    foreach ($rows as $idx => $row) {
        $productSku = $row['product_sku'] ?? null;
        $productName = $row['product_name'] ?? null;
        $variantCode = $row['variant_code'] ?? null;
        $variantName = $row['variant_name'] ?? null;
        $internalOrderId = $row['internal_order_id'] ?? null;
        $onlineOrderId = $row['online_order_id'] ?? null;
        $qty = (float)($row['quantity'] ?? 0);
        $totalPrice = $row['total_price'] ?? null;
        $orderDate = $row['order_date'] ?? null;
        $shipDate = $row['ship_date'] ?? null;
        $orderStatus = $row['order_status'] ?? null;
        $platform = $row['platform'] ?? null;
        $shop = $row['shop'] ?? null;
        $warehouseName = $row['warehouse_name'] ?? null; // dispatch warehouse name
        $trackingNumber = $row['tracking_number'] ?? null;
        $status = $row['status'] ?? null;
        $productId = $row['product_id'] ?? null;
        
        $stockDeducted = 0;

        // Lookup mapped main_warehouse_id if available
        $mappedWarehouseId = null;
        if ($warehouseName) {
            $stmtMap = $pdo->prepare("SELECT main_warehouse_id FROM inv2_warehouse_mappings WHERE company_id = ? AND dispatch_warehouse_name = ?");
            $stmtMap->execute([$companyId, $warehouseName]);
            $mappedWarehouseId = $stmtMap->fetchColumn();
        }
        
        $targetWarehouseId = $mappedWarehouseId ? $mappedWarehouseId : ($row['warehouse_id'] ?? null);

        // Only attempt stock deduction if we have matched product, TARGET warehouse, and positive qty
        if ($productId && $targetWarehouseId && $qty > 0) {
            // FIFO: Get stock lots sorted by quantity>0 DESC (positive first), exp_date ASC, created_at ASC
            $fifoSql = "SELECT id, lot_number, variant, quantity, exp_date
                        FROM inv2_stock
                        WHERE warehouse_id = ? AND product_id = ? AND quantity > -999999
                        ORDER BY quantity > 0 DESC, COALESCE(exp_date, '9999-12-31') ASC, created_at ASC";

            $stmtFifo = $pdo->prepare($fifoSql);
            $stmtFifo->execute([$targetWarehouseId, $productId]);
            $lots = $stmtFifo->fetchAll(PDO::FETCH_ASSOC);

            $remaining = $qty;
            $deductions = [];

            if (empty($lots)) {
                // No lots exist at all! Force create a negative SYS-OVERDRAW lot
                $pdo->prepare("INSERT INTO inv2_stock (warehouse_id, product_id, lot_number, quantity, mfg_date, exp_date, unit_cost) VALUES (?, ?, 'SYS-OVERDRAW', ?, NULL, NULL, 0)")
                    ->execute([$targetWarehouseId, $productId, -$qty]);
                
                $pdo->prepare("INSERT INTO inv2_movements (warehouse_id, product_id, variant, lot_number, movement_type, quantity, reference_type, reference_doc_number, reference_order_id, notes, created_by, company_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
                    ->execute([$targetWarehouseId, $productId, $variantCode, 'SYS-OVERDRAW', 'OUT', $qty, 'dispatch', $batchDocNumber, $internalOrderId, $notes, $userId, $companyId]);
                
                $stockDeducted = 1;
                $processedCount++;
            } else {
                foreach ($lots as $idxLot => $lot) {
                    if ($remaining <= 0) break;
                    
                    if ($idxLot === count($lots) - 1) {
                        // Very last available lot: Takes all remaining hit, goes negative if necessary
                        $deductQty = $remaining;
                    } else {
                        // Normal FIFO
                        $available = (float)$lot['quantity'];
                        if ($available <= 0) $available = 0; // Skip negative balances until last lot
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

                // Apply deductions
                foreach ($deductions as $ded) {
                    $pdo->prepare("UPDATE inv2_stock SET quantity = quantity - ? WHERE id = ?")
                        ->execute([$ded['quantity'], $ded['stock_id']]);

                    $pdo->prepare("INSERT INTO inv2_movements (warehouse_id, product_id, variant, lot_number, movement_type, quantity, reference_type, reference_doc_number, reference_order_id, notes, created_by, company_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
                        ->execute([$targetWarehouseId, $productId, $ded['variant'] ?? null, $ded['lot_number'], 'OUT', $ded['quantity'], 'dispatch', $batchDocNumber, $internalOrderId, $notes, $userId, $companyId]);
                }
                
                $stockDeducted = 1;
                $processedCount++;
            }
        } else {
            if (!$productId) $errors[] = "Row " . ($idx + 1) . " ($productSku): ไม่พบ Product ID (Mapping ผิดพลาด)";
            else if (!$targetWarehouseId) $errors[] = "Row " . ($idx + 1) . " ($productSku): ไม่สามารถจับคู่คลังจ่ายได้ ($warehouseName)";
            else if ($qty <= 0) $errors[] = "Row " . ($idx + 1) . " ($productSku): จำนวน = 0";
        }

        // Insert dispatch item 
        $pdo->prepare("INSERT INTO inv2_dispatch_items (batch_id, row_index, product_sku, product_name, variant_code, variant_name, internal_order_id, online_order_id, quantity, total_price, order_date, ship_date, order_status, platform, shop, warehouse_name, tracking_number, status, product_id, warehouse_id, stock_deducted) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
            ->execute([$batchId, $idx, $productSku, $productName, $variantCode, $variantName, $internalOrderId, $onlineOrderId, $qty, $totalPrice, $orderDate, $shipDate, $orderStatus, $platform, $shop, $warehouseName, $trackingNumber, $status, $productId, $targetWarehouseId, $stockDeducted]);
    }

    // Update processed count
    $pdo->prepare("UPDATE inv2_dispatch_batches SET processed_rows = ? WHERE id = ?")
        ->execute([$processedCount, $batchId]);

    $pdo->commit();

    echo json_encode([
        'success' => true,
        'batch_id' => $batchId,
        'batch_doc_number' => $batchDocNumber,
        'total_rows' => count($rows),
        'processed' => $processedCount,
        'errors' => $errors
    ]);

} catch (Exception $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
