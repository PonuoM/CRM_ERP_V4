<?php
// Receive Delete API — Delete a receive document and reverse stock additions
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

require_once __DIR__ . '/../config.php';
$pdo = db_connect();

try {
    $input = json_decode(file_get_contents('php://input'), true);
    $docId = $input['doc_id'] ?? ($_GET['doc_id'] ?? null);
    if (!$docId) throw new Exception('doc_id required');

    // Get document info
    $stmt = $pdo->prepare("SELECT * FROM inv2_receive_documents WHERE id = ?");
    $stmt->execute([$docId]);
    $doc = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$doc) throw new Exception('Document not found');

    $docNumber = $doc['doc_number'];

    $pdo->beginTransaction();

    // 1. Find all movements for this receive doc and REVERSE them (deduct stock that was added)
    $stmt = $pdo->prepare("SELECT id, warehouse_id, product_id, variant, lot_number, quantity FROM inv2_movements WHERE reference_type = 'receive' AND reference_doc_number = ?");
    $stmt->execute([$docNumber]);
    $movements = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $reversedQty = 0;
    foreach ($movements as $mov) {
        $lotKey = $mov['lot_number'] ?? '';

        // Find the stock row and deduct (reverse the addition, key: warehouse+product+lot)
        $findStock = $pdo->prepare("SELECT id, quantity FROM inv2_stock WHERE warehouse_id = ? AND product_id = ? AND COALESCE(lot_number,'') = ?");
        $findStock->execute([$mov['warehouse_id'], $mov['product_id'], $lotKey]);
        $stockRow = $findStock->fetch(PDO::FETCH_ASSOC);

        if ($stockRow) {
            $newQty = max(0, (float)$stockRow['quantity'] - (float)$mov['quantity']);
            $pdo->prepare("UPDATE inv2_stock SET quantity = ? WHERE id = ?")->execute([$newQty, $stockRow['id']]);
        }

        $reversedQty += (float)$mov['quantity'];
    }

    // 2. Delete movements
    $pdo->prepare("DELETE FROM inv2_movements WHERE reference_type = 'receive' AND reference_doc_number = ?")->execute([$docNumber]);

    // 3. If linked to SO, update SO item received quantities
    if ($doc['stock_order_id']) {
        // Get receive items to know what was received
        $stmt = $pdo->prepare("SELECT so_item_id, quantity FROM inv2_receive_items WHERE receive_doc_id = ? AND so_item_id IS NOT NULL");
        $stmt->execute([$docId]);
        $receiveItems = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($receiveItems as $ri) {
            if ($ri['so_item_id']) {
                $pdo->prepare("UPDATE inv2_stock_order_items SET received_quantity = GREATEST(0, received_quantity - ?) WHERE id = ?")
                    ->execute([(float)$ri['quantity'], $ri['so_item_id']]);
            }
        }

        // Re-evaluate SO status
        $soId = $doc['stock_order_id'];
        $stmt = $pdo->prepare("SELECT SUM(quantity) as total_qty, SUM(received_quantity) as total_received FROM inv2_stock_order_items WHERE stock_order_id = ?");
        $stmt->execute([$soId]);
        $soTotals = $stmt->fetch(PDO::FETCH_ASSOC);

        $totalQty = (float)($soTotals['total_qty'] ?? 0);
        $totalReceived = (float)($soTotals['total_received'] ?? 0);

        if ($totalReceived <= 0) {
            $newStatus = 'Ordered';
        } elseif ($totalReceived < $totalQty) {
            $newStatus = 'Partial';
        } else {
            $newStatus = 'Completed';
        }
        $pdo->prepare("UPDATE inv2_stock_orders SET status = ? WHERE id = ?")->execute([$newStatus, $soId]);
    }

    // 4. Delete receive items
    $pdo->prepare("DELETE FROM inv2_receive_items WHERE receive_doc_id = ?")->execute([$docId]);

    // 5. Delete receive document
    $pdo->prepare("DELETE FROM inv2_receive_documents WHERE id = ?")->execute([$docId]);

    $pdo->commit();

    echo json_encode([
        'success' => true,
        'message' => "เอกสาร $docNumber ถูกลบแล้ว หักคืนยอด stock $reversedQty หน่วย",
        'reversed_movements' => count($movements),
        'reversed_quantity' => $reversedQty
    ]);

} catch (Exception $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
