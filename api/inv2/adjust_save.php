<?php
// Adjustment Save API — Adjust stock (add or reduce) with images
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
    $images = $input['images'] ?? [];
    $items = $input['items'] ?? [];

    if (empty($items)) throw new Exception('At least one item required');

    $pdo->beginTransaction();

    // Generate doc number: ADJ-YYYYMMDD-XXXXX
    $datePart = date('Ymd');
    $stmt = $pdo->prepare("SELECT COUNT(DISTINCT reference_doc_number) FROM inv2_movements WHERE reference_type = 'adjustment' AND reference_doc_number LIKE ?");
    $stmt->execute(["ADJ-$datePart-%"]);
    $count = (int)$stmt->fetchColumn();
    $docNumber = "ADJ-$datePart-" . str_pad($count + 1, 5, '0', STR_PAD_LEFT);

    foreach ($items as $item) {
        $warehouseId = $item['warehouse_id'] ?? null;
        $productId = $item['product_id'] ?? null;
        $variant = $item['variant'] ?? null;
        $lotNumber = $item['lot_number'] ?? null;
        $adjustType = $item['adjust_type'] ?? 'add'; // 'add' or 'reduce'
        $qty = abs((float)($item['quantity'] ?? 0));
        $mfgDate = $item['mfg_date'] ?? null;
        $expDate = $item['exp_date'] ?? null;
        $unitCost = $item['unit_cost'] ?? null;
        $itemNotes = $item['notes'] ?? $notes;

        if (!$warehouseId || !$productId || $qty <= 0) continue;

        $movementType = ($adjustType === 'reduce') ? 'ADJUST_OUT' : 'ADJUST_IN';

        // Upsert stock
        $variantKey = $variant ?? '';
        $lotKey = $lotNumber ?? '';
        $stmt = $pdo->prepare("SELECT id, quantity FROM inv2_stock WHERE warehouse_id = ? AND product_id = ? AND COALESCE(variant,'') = ? AND COALESCE(lot_number,'') = ?");
        $stmt->execute([$warehouseId, $productId, $variantKey, $lotKey]);
        $stock = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($adjustType === 'reduce') {
            if ($stock) {
                $pdo->prepare("UPDATE inv2_stock SET quantity = quantity - ? WHERE id = ?")
                    ->execute([$qty, $stock['id']]);
            } else {
                // Create with negative? Or error? Allow negative for adjustment purposes
                $pdo->prepare("INSERT INTO inv2_stock (warehouse_id, product_id, variant, lot_number, quantity, mfg_date, exp_date, unit_cost) VALUES (?,?,?,?,?,?,?,?)")
                    ->execute([$warehouseId, $productId, $variant ?: null, $lotNumber ?: null, -$qty, $mfgDate, $expDate, $unitCost]);
            }
        } else {
            if ($stock) {
                $pdo->prepare("UPDATE inv2_stock SET quantity = quantity + ?, mfg_date = COALESCE(?, mfg_date), exp_date = COALESCE(?, exp_date), unit_cost = COALESCE(?, unit_cost) WHERE id = ?")
                    ->execute([$qty, $mfgDate, $expDate, $unitCost, $stock['id']]);
            } else {
                $pdo->prepare("INSERT INTO inv2_stock (warehouse_id, product_id, variant, lot_number, quantity, mfg_date, exp_date, unit_cost) VALUES (?,?,?,?,?,?,?,?)")
                    ->execute([$warehouseId, $productId, $variant ?: null, $lotNumber ?: null, $qty, $mfgDate, $expDate, $unitCost]);
            }
        }

        // Log movement
        $pdo->prepare("INSERT INTO inv2_movements (warehouse_id, product_id, variant, lot_number, movement_type, quantity, reference_type, reference_doc_number, notes, images, created_by, company_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
            ->execute([$warehouseId, $productId, $variant, $lotNumber, $movementType, $qty, 'adjustment', $docNumber, $itemNotes, json_encode($images), $userId, $companyId]);
    }

    $pdo->commit();

    echo json_encode(['success' => true, 'doc_number' => $docNumber]);

} catch (Exception $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
