<?php
// Dispatch Import API — Import CSV dispatch data, auto-FIFO deduct stock
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
    $rows = $input['rows'] ?? [];

    if (empty($rows)) throw new Exception('No dispatch rows provided');

    $pdo->beginTransaction();

    // Generate batch doc number: DSP-YYYYMMDD-XXXXX
    $datePart = date('Ymd');
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM inv2_movements WHERE reference_type = 'dispatch' AND reference_doc_number LIKE ?");
    $stmt->execute(["DSP-$datePart-%"]);
    $existingBatches = $pdo->prepare("SELECT COUNT(DISTINCT reference_doc_number) FROM inv2_movements WHERE reference_type = 'dispatch' AND reference_doc_number LIKE ?");
    $existingBatches->execute(["DSP-$datePart-%"]);
    $batchCount = (int)$existingBatches->fetchColumn();
    $batchDocNumber = "DSP-$datePart-" . str_pad($batchCount + 1, 5, '0', STR_PAD_LEFT);

    $results = [];
    $errors = [];

    foreach ($rows as $idx => $row) {
        $warehouseId = $row['warehouse_id'] ?? null;
        $productId = $row['product_id'] ?? null;
        $variant = $row['variant'] ?? null;
        $qtyToDispatch = (float)($row['quantity'] ?? 0);
        $referenceOrderId = $row['reference_order_id'] ?? null;
        $rowNotes = $row['notes'] ?? $notes;

        if (!$warehouseId || !$productId || $qtyToDispatch <= 0) {
            $errors[] = "Row $idx: Missing warehouse_id, product_id, or invalid quantity";
            continue;
        }

        // FIFO: Get stock lots sorted by exp_date ASC, created_at ASC
        $variantCond = $variant ? "AND COALESCE(variant,'') = ?" : "AND (variant IS NULL OR variant = '')";
        $fifoParams = [$warehouseId, $productId];
        if ($variant) $fifoParams[] = $variant;

        $fifoSql = "SELECT id, lot_number, quantity, exp_date
                    FROM inv2_stock
                    WHERE warehouse_id = ? AND product_id = ? $variantCond AND quantity > 0
                    ORDER BY COALESCE(exp_date, '9999-12-31') ASC, created_at ASC";

        $stmtFifo = $pdo->prepare($fifoSql);
        $stmtFifo->execute($fifoParams);
        $lots = $stmtFifo->fetchAll(PDO::FETCH_ASSOC);

        $remaining = $qtyToDispatch;
        $deductions = [];

        foreach ($lots as $lot) {
            if ($remaining <= 0) break;

            $deductQty = min($remaining, (float)$lot['quantity']);
            $deductions[] = [
                'stock_id' => $lot['id'],
                'lot_number' => $lot['lot_number'],
                'quantity' => $deductQty
            ];
            $remaining -= $deductQty;
        }

        if ($remaining > 0.001) {
            $errors[] = "Row $idx: Insufficient stock. Needed: $qtyToDispatch, Available: " . ($qtyToDispatch - $remaining) . ". Short by: $remaining";
            continue;
        }

        // Apply deductions
        foreach ($deductions as $ded) {
            // Reduce stock
            $pdo->prepare("UPDATE inv2_stock SET quantity = quantity - ? WHERE id = ?")
                ->execute([$ded['quantity'], $ded['stock_id']]);

            // Log movement
            $pdo->prepare("INSERT INTO inv2_movements (warehouse_id, product_id, variant, lot_number, movement_type, quantity, reference_type, reference_doc_number, reference_order_id, notes, created_by, company_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
                ->execute([$warehouseId, $productId, $variant, $ded['lot_number'], 'OUT', $ded['quantity'], 'dispatch', $batchDocNumber, $referenceOrderId, $rowNotes, $userId, $companyId]);
        }

        $results[] = [
            'row' => $idx,
            'product_id' => $productId,
            'warehouse_id' => $warehouseId,
            'dispatched' => $qtyToDispatch,
            'lots_used' => count($deductions)
        ];
    }

    $pdo->commit();

    echo json_encode([
        'success' => true,
        'batch_doc_number' => $batchDocNumber,
        'processed' => count($results),
        'errors' => $errors,
        'results' => $results
    ]);

} catch (Exception $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
