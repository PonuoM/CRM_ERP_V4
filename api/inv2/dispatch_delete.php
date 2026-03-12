<?php
// Dispatch Delete API — Delete a batch and reverse all stock deductions
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

require_once __DIR__ . '/../config.php';
$pdo = db_connect();

try {
    $input = json_decode(file_get_contents('php://input'), true);
    $batchId = $input['batch_id'] ?? ($_GET['batch_id'] ?? null);
    if (!$batchId) throw new Exception('batch_id required');

    // Get batch info
    $stmt = $pdo->prepare("SELECT * FROM inv2_dispatch_batches WHERE id = ?");
    $stmt->execute([$batchId]);
    $batch = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$batch) throw new Exception('Batch not found');

    $batchDocNumber = $batch['batch_doc_number'];

    $pdo->beginTransaction();

    // 1. Find all movements for this batch and REVERSE them (add stock back)
    $stmt = $pdo->prepare("SELECT warehouse_id, product_id, variant, lot_number, quantity FROM inv2_movements WHERE reference_type = 'dispatch' AND reference_doc_number = ?");
    $stmt->execute([$batchDocNumber]);
    $movements = $stmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($movements as $mov) {
        $variantKey = $mov['variant'] ?? '';
        $lotKey = $mov['lot_number'] ?? '';

        // Find the stock row and add back
        $findStock = $pdo->prepare("SELECT id FROM inv2_stock WHERE warehouse_id = ? AND product_id = ? AND COALESCE(variant,'') = ? AND COALESCE(lot_number,'') = ?");
        $findStock->execute([$mov['warehouse_id'], $mov['product_id'], $variantKey, $lotKey]);
        $stockId = $findStock->fetchColumn();

        if ($stockId) {
            $pdo->prepare("UPDATE inv2_stock SET quantity = quantity + ? WHERE id = ?")
                ->execute([(float)$mov['quantity'], $stockId]);
        } else {
            // Stock row was deleted or doesn't exist, recreate it
            $pdo->prepare("INSERT INTO inv2_stock (warehouse_id, product_id, variant, lot_number, quantity) VALUES (?,?,?,?,?)")
                ->execute([$mov['warehouse_id'], $mov['product_id'], $mov['variant'] ?: null, $mov['lot_number'] ?: null, (float)$mov['quantity']]);
        }
    }

    $reversedQty = 0;
    foreach ($movements as $m) { $reversedQty += (float)$m['quantity']; }

    // 2. Delete movements
    $pdo->prepare("DELETE FROM inv2_movements WHERE reference_type = 'dispatch' AND reference_doc_number = ?")
        ->execute([$batchDocNumber]);

    // 3. Delete dispatch items (CASCADE should handle this, but be explicit)
    $pdo->prepare("DELETE FROM inv2_dispatch_items WHERE batch_id = ?")->execute([$batchId]);

    // 4. Delete batch
    $pdo->prepare("DELETE FROM inv2_dispatch_batches WHERE id = ?")->execute([$batchId]);

    $pdo->commit();

    echo json_encode([
        'success' => true,
        'message' => "Batch $batchDocNumber deleted. Reversed $reversedQty units back to stock.",
        'reversed_movements' => count($movements),
        'reversed_quantity' => $reversedQty
    ]);

} catch (Exception $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
