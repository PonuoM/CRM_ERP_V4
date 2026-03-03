<?php
// Receive Save API — Create receive document, update stock & SO received quantities
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

    $stockOrderId = $input['stock_order_id'] ?? null;
    $warehouseId = $input['warehouse_id'] ?? null;
    $receiveDate = $input['receive_date'] ?? date('Y-m-d');
    $notes = $input['notes'] ?? null;
    $images = $input['images'] ?? [];
    $userId = $input['user_id'] ?? 1;
    $companyId = $input['company_id'] ?? 1;
    $items = $input['items'] ?? [];

    if (!$warehouseId) throw new Exception('Warehouse ID required');
    if (empty($items)) throw new Exception('At least one item required');

    $pdo->beginTransaction();

    // Generate doc number: RCV-YYYYMMDD-XXXXX
    $datePart = date('Ymd', strtotime($receiveDate));
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM inv2_receive_documents WHERE doc_number LIKE ?");
    $stmt->execute(["RCV-$datePart-%"]);
    $count = (int)$stmt->fetchColumn();
    $docNumber = "RCV-$datePart-" . str_pad($count + 1, 5, '0', STR_PAD_LEFT);

    // Create receive document
    $pdo->prepare("INSERT INTO inv2_receive_documents (doc_number, stock_order_id, warehouse_id, receive_date, notes, images, created_by, company_id) VALUES (?,?,?,?,?,?,?,?)")
        ->execute([$docNumber, $stockOrderId, $warehouseId, $receiveDate, $notes, json_encode($images), $userId, $companyId]);
    $docId = $pdo->lastInsertId();

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

        // 1. Insert receive item
        $pdo->prepare("INSERT INTO inv2_receive_items (receive_doc_id, so_item_id, product_id, variant, lot_number, quantity, unit_cost, mfg_date, exp_date, notes) VALUES (?,?,?,?,?,?,?,?,?,?)")
            ->execute([$docId, $soItemId, $productId, $variant, $lotNumber, $qty, $unitCost, $mfgDate, $expDate, $itemNotes]);

        // 2. Update SO item received_quantity (if SO reference exists)
        if ($soItemId) {
            $pdo->prepare("UPDATE inv2_stock_order_items SET received_quantity = received_quantity + ? WHERE id = ?")
                ->execute([$qty, $soItemId]);
        }

        // 3. Upsert inv2_stock
        // Use COALESCE for NULL variant/lot to make unique key work
        $variantKey = $variant ?? '';
        $lotKey = $lotNumber ?? '';
        $stmt = $pdo->prepare("SELECT id FROM inv2_stock WHERE warehouse_id = ? AND product_id = ? AND COALESCE(variant,'') = ? AND COALESCE(lot_number,'') = ?");
        $stmt->execute([$warehouseId, $productId, $variantKey, $lotKey]);
        $stockId = $stmt->fetchColumn();

        if ($stockId) {
            $pdo->prepare("UPDATE inv2_stock SET quantity = quantity + ?, mfg_date = COALESCE(?, mfg_date), exp_date = COALESCE(?, exp_date), unit_cost = COALESCE(?, unit_cost) WHERE id = ?")
                ->execute([$qty, $mfgDate, $expDate, $unitCost, $stockId]);
        } else {
            $pdo->prepare("INSERT INTO inv2_stock (warehouse_id, product_id, variant, lot_number, quantity, mfg_date, exp_date, unit_cost) VALUES (?,?,?,?,?,?,?,?)")
                ->execute([$warehouseId, $productId, $variant ?: null, $lotNumber ?: null, $qty, $mfgDate, $expDate, $unitCost]);
        }

        // 4. Insert movement log
        $pdo->prepare("INSERT INTO inv2_movements (warehouse_id, product_id, variant, lot_number, movement_type, quantity, reference_type, reference_id, reference_doc_number, notes, created_by, company_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
            ->execute([$warehouseId, $productId, $variant, $lotNumber, 'IN', $qty, 'receive', $docId, $docNumber, $itemNotes, $userId, $companyId]);
    }

    // 5. Update SO status
    if ($stockOrderId) {
        $stmt = $pdo->prepare("SELECT SUM(quantity) as total_qty, SUM(received_quantity) as total_received FROM inv2_stock_order_items WHERE stock_order_id = ?");
        $stmt->execute([$stockOrderId]);
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
            ->execute([$newStatus, $stockOrderId]);
    }

    $pdo->commit();

    echo json_encode(['success' => true, 'id' => (int)$docId, 'doc_number' => $docNumber]);

} catch (Exception $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
