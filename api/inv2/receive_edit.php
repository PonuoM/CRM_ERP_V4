<?php
// Receive Edit API — Edit receive document, creating edit log and adjusting stock properly
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

    $docId = $input['id'] ?? null;
    $stockOrderId = $input['stock_order_id'] ?? null;
    $warehouseId = $input['warehouse_id'] ?? null;
    $receiveDate = $input['receive_date'] ?? date('Y-m-d');
    $notes = $input['notes'] ?? null;
    $images = $input['images'] ?? [];
    $userId = $input['user_id'] ?? 1;
    $companyId = $input['company_id'] ?? 1;
    $items = $input['items'] ?? [];

    if (!$docId) throw new Exception('Document ID required for edit');
    if (!$warehouseId) throw new Exception('Warehouse ID required');
    if (empty($items)) throw new Exception('At least one item required');

    // 0. Ensure edit logs table exists
    $pdo->exec("CREATE TABLE IF NOT EXISTS inv2_edit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        reference_type VARCHAR(50) NOT NULL,
        reference_id INT NOT NULL,
        user_id INT NOT NULL,
        old_data LONGTEXT,
        new_data LONGTEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )");

    $pdo->beginTransaction();

    // 1. Fetch Old Data Snapshot for Logging
    $stmt = $pdo->prepare("SELECT * FROM inv2_receive_documents WHERE id = ?");
    $stmt->execute([$docId]);
    $oldDoc = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$oldDoc) throw new Exception('Document not found');
    $docNumber = $oldDoc['doc_number'];

    $stmt = $pdo->prepare("SELECT * FROM inv2_receive_items WHERE receive_doc_id = ?");
    $stmt->execute([$docId]);
    $oldItems = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $oldDataSnapshot = ['document' => $oldDoc, 'items' => $oldItems];

    // Log the edit
    $pdo->prepare("INSERT INTO inv2_edit_logs (reference_type, reference_id, user_id, old_data, new_data) VALUES (?,?,?,?,?)")
        ->execute(['receive', $docId, $userId, json_encode($oldDataSnapshot), json_encode($input)]);

    // 2. Reverse OLD Stock Additions (Deduct)
    $stmt = $pdo->prepare("SELECT id, warehouse_id, product_id, variant, lot_number, quantity FROM inv2_movements WHERE reference_type = 'receive' AND reference_doc_number = ?");
    $stmt->execute([$docNumber]);
    $movements = $stmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($movements as $mov) {
        $lotKey = $mov['lot_number'] ?? '';
        $findStock = $pdo->prepare("SELECT id, quantity FROM inv2_stock WHERE warehouse_id = ? AND product_id = ? AND COALESCE(lot_number,'') = ?");
        $findStock->execute([$mov['warehouse_id'], $mov['product_id'], $lotKey]);
        $stockRow = $findStock->fetch(PDO::FETCH_ASSOC);

        if ($stockRow) {
            $newQty = max(0, (float)$stockRow['quantity'] - (float)$mov['quantity']);
            $pdo->prepare("UPDATE inv2_stock SET quantity = ? WHERE id = ?")->execute([$newQty, $stockRow['id']]);
        }
    }
    // Delete old movements
    $pdo->prepare("DELETE FROM inv2_movements WHERE reference_type = 'receive' AND reference_doc_number = ?")->execute([$docNumber]);

    // Reverse old SO quantities if linked
    if ($oldDoc['stock_order_id']) {
        foreach ($oldItems as $ri) {
            if ($ri['so_item_id']) {
                $pdo->prepare("UPDATE inv2_stock_order_items SET received_quantity = GREATEST(0, received_quantity - ?) WHERE id = ?")
                    ->execute([(float)$ri['quantity'], $ri['so_item_id']]);
            }
        }
    }

    // Delete old items
    $pdo->prepare("DELETE FROM inv2_receive_items WHERE receive_doc_id = ?")->execute([$docId]);


    // 3. Apply NEW Document Data and Add Additions
    $pdo->prepare("UPDATE inv2_receive_documents SET stock_order_id = ?, warehouse_id = ?, receive_date = ?, notes = ?, images = ? WHERE id = ?")
        ->execute([$stockOrderId, $warehouseId, $receiveDate, $notes, json_encode($images), $docId]);

    foreach ($items as $item) {
        $productId = $item['product_id'] ?? null;
        if (!$productId) continue;

        $variant = $item['variant'] ?? null;
        $lotNumber = $item['lot_number'] ?? null;
        $qty = (float)($item['quantity'] ?? 0);
        $unitCost = $item['unit_cost'] ?? null;
        $mfgDate = $item['mfg_date'] ?? null;
        $expDate = $item['exp_date'] ?? null;
        $soItemId = $item['so_item_id'] ?? null;
        $itemNotes = $item['notes'] ?? null;

        if ($qty <= 0) continue;

        // Insert new receive item
        $pdo->prepare("INSERT INTO inv2_receive_items (receive_doc_id, so_item_id, product_id, variant, lot_number, quantity, unit_cost, mfg_date, exp_date, notes) VALUES (?,?,?,?,?,?,?,?,?,?)")
            ->execute([$docId, $soItemId, $productId, $variant, $lotNumber, $qty, $unitCost, $mfgDate, $expDate, $itemNotes]);

        // Update SO item received_quantity (if SO reference exists)
        if ($soItemId) {
            $pdo->prepare("UPDATE inv2_stock_order_items SET received_quantity = received_quantity + ? WHERE id = ?")
                ->execute([$qty, $soItemId]);
        }

        // Upsert inv2_stock (key: warehouse + product + lot)
        $lotKey = $lotNumber ?? '';
        $stmt = $pdo->prepare("SELECT id FROM inv2_stock WHERE warehouse_id = ? AND product_id = ? AND COALESCE(lot_number,'') = ?");
        $stmt->execute([$warehouseId, $productId, $lotKey]);
        $stockId = $stmt->fetchColumn();

        if ($stockId) {
            $pdo->prepare("UPDATE inv2_stock SET quantity = quantity + ?, mfg_date = COALESCE(?, mfg_date), exp_date = COALESCE(?, exp_date), unit_cost = COALESCE(?, unit_cost) WHERE id = ?")
                ->execute([$qty, $mfgDate, $expDate, $unitCost, $stockId]);
        } else {
            $pdo->prepare("INSERT INTO inv2_stock (warehouse_id, product_id, lot_number, quantity, mfg_date, exp_date, unit_cost) VALUES (?,?,?,?,?,?,?)")
                ->execute([$warehouseId, $productId, $lotNumber ?: null, $qty, $mfgDate, $expDate, $unitCost]);
        }

        // Insert new movement log
        $pdo->prepare("INSERT INTO inv2_movements (warehouse_id, product_id, variant, lot_number, movement_type, quantity, reference_type, reference_id, reference_doc_number, notes, created_by, company_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
            ->execute([$warehouseId, $productId, $variant, $lotNumber, 'IN', $qty, 'receive', $docId, $docNumber, $itemNotes, $userId, $companyId]);
    }

    // 4. Update SO Status (if applicable)
    $checkSoId = $stockOrderId ?: $oldDoc['stock_order_id']; // Handle case where it was removed or added
    if ($checkSoId) {
        $stmt = $pdo->prepare("SELECT SUM(quantity) as total_qty, SUM(received_quantity) as total_received FROM inv2_stock_order_items WHERE stock_order_id = ?");
        $stmt->execute([$checkSoId]);
        $soTotals = $stmt->fetch(PDO::FETCH_ASSOC);

        $totalQty = (float)$soTotals['total_qty'];
        $totalReceived = (float)$soTotals['total_received'];

        if ($totalReceived >= $totalQty) {
            $newStatus = 'Completed';
        } elseif ($totalReceived > 0) {
            $newStatus = 'Partial';
        } else {
            $newStatus = 'Ordered';
        }

        $pdo->prepare("UPDATE inv2_stock_orders SET status = ? WHERE id = ?")
            ->execute([$newStatus, $checkSoId]);
    }

    $pdo->commit();

    echo json_encode(['success' => true, 'id' => (int)$docId, 'doc_number' => $docNumber]);

} catch (Exception $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
