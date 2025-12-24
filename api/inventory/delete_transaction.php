<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: DELETE, OPTIONS");
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

    $pdo->beginTransaction();

    // 1. Get Transaction Info
    $stmt = $pdo->prepare("SELECT * FROM stock_transactions WHERE id = ?");
    $stmt->execute([$id]);
    $transaction = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$transaction) {
        throw new Exception("Transaction not found");
    }

    // 2. Get Items to Revert Stock
    $stmtItems = $pdo->prepare("SELECT * FROM stock_transaction_items WHERE transaction_id = ?");
    $stmtItems->execute([$id]);
    $items = $stmtItems->fetchAll(PDO::FETCH_ASSOC);

    foreach ($items as $item) {
        $lotId = $item['lot_id'];
        $qty = $item['quantity'];
        $type = $item['adjustment_type']; // 'add', 'reduce', 'receive'
        $warehouseId = $item['warehouse_id'];
        $productId = $item['product_id'];

        // Revert Stock Logic
        if ($type === 'receive' || $type === 'add') {
            // It WAS a formatted addition, so we must REDUCE now.
            // Check if Lot exists
            if ($lotId) {
                // Ensure we don't reduce below zero? 
                // Strict: Yes. Loose: No. 
                // Let's check remaining
                $lot = $pdo->query("SELECT quantity_remaining FROM product_lots WHERE id = $lotId")->fetchColumn();
                if ($lot < $qty) {
                    // Warning: Stock already consumed.
                    // Option A: Block delete.
                    // Option B: Allow negative.
                    // User Request: just "delete". Let's allow but maybe should warn. 
                    // For now, allow negative to ensure deletion works.
                }
                
                $pdo->prepare("UPDATE product_lots SET quantity_remaining = quantity_remaining - ?, quantity_received = quantity_received - ? WHERE id = ?")
                    ->execute([$qty, ($type==='receive'?$qty:0), $lotId]);
            }

            // Reduce Warehouse Stock
             $pdo->prepare("UPDATE warehouse_stocks SET quantity = quantity - ? WHERE product_id = ? AND warehouse_id = ? AND product_lot_id = ?") // Approximate matching
                 ->execute([$qty, $productId, $warehouseId, $lotId]);

        } elseif ($type === 'reduce') {
            // It WAS a reduction, so we must ADD back.
            if ($lotId) {
                $pdo->prepare("UPDATE product_lots SET quantity_remaining = quantity_remaining + ? WHERE id = ?")
                    ->execute([$qty, $lotId]);
            }
             $pdo->prepare("UPDATE warehouse_stocks SET quantity = quantity + ? WHERE product_id = ? AND warehouse_id = ? AND product_lot_id = ?")
                 ->execute([$qty, $productId, $warehouseId, $lotId]);
        }
        
        // Fetch Lot Number for Log
        $lotNumber = null;
        if ($lotId) {
            $lotNumber = $pdo->query("SELECT lot_number FROM product_lots WHERE id = $lotId")->fetchColumn();
        }

        // Log Reversal Movement?
        // Ideally yes. "VOID" -> "Delete Document"
        $pdo->prepare("INSERT INTO stock_movements (warehouse_id, product_id, movement_type, quantity, lot_number, document_number, reference_type, reference_id, reason, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
            ->execute([$warehouseId, $productId, 'Delete Document', ($type==='reduce'?$qty:-$qty), $lotNumber, $transaction['document_number'], 'stock_transactions', $id, 'Void Transaction ' . $transaction['document_number'], $transaction['created_by']]);
    }

    // 3. Delete Linked Data
    $pdo->prepare("DELETE FROM stock_transaction_items WHERE transaction_id = ?")->execute([$id]);
    $pdo->prepare("DELETE FROM stock_transaction_images WHERE transaction_id = ?")->execute([$id]);
    $pdo->prepare("DELETE FROM stock_transactions WHERE id = ?")->execute([$id]);

    $pdo->commit();
    echo json_encode(['success' => true]);

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
