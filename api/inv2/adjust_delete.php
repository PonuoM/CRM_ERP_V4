<?php
// Adjustment Delete API — Delete an adjustment document and reverse stock changes
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

require_once __DIR__ . '/../config.php';
$pdo = db_connect();

try {
    $input = json_decode(file_get_contents('php://input'), true);
    $docNumber = $input['doc_number'] ?? ($_GET['doc_number'] ?? null);
    if (!$docNumber) throw new Exception('doc_number required');

    $pdo->beginTransaction();

    // 1. Find all movements for this adjustment doc
    $stmt = $pdo->prepare("SELECT id, warehouse_id, product_id, lot_number, movement_type, quantity FROM inv2_movements WHERE reference_type = 'adjustment' AND reference_doc_number = ?");
    $stmt->execute([$docNumber]);
    $movements = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (empty($movements)) throw new Exception("No movements found for $docNumber");

    // 2. Reverse each movement
    $reversedQty = 0;
    foreach ($movements as $mov) {
        $lotKey = $mov['lot_number'] ?? '';

        // Find the stock row (key: warehouse + product + lot)
        $findStock = $pdo->prepare("SELECT id, quantity FROM inv2_stock WHERE warehouse_id = ? AND product_id = ? AND COALESCE(lot_number,'') = ?");
        $findStock->execute([$mov['warehouse_id'], $mov['product_id'], $lotKey]);
        $stockRow = $findStock->fetch(PDO::FETCH_ASSOC);

        if ($stockRow) {
            if ($mov['movement_type'] === 'ADJUST_IN') {
                // Was an addition → reverse by subtracting
                $pdo->prepare("UPDATE inv2_stock SET quantity = quantity - ? WHERE id = ?")
                    ->execute([(float)$mov['quantity'], $stockRow['id']]);
            } else {
                // Was a reduction → reverse by adding back
                $pdo->prepare("UPDATE inv2_stock SET quantity = quantity + ? WHERE id = ?")
                    ->execute([(float)$mov['quantity'], $stockRow['id']]);
            }
        }

        $reversedQty += (float)$mov['quantity'];
    }

    // 3. Delete movements
    $pdo->prepare("DELETE FROM inv2_movements WHERE reference_type = 'adjustment' AND reference_doc_number = ?")
        ->execute([$docNumber]);

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
