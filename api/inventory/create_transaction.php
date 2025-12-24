<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once '../config.php';
$pdo = db_connect();

try {
    $input = json_decode(file_get_contents('php://input'), true);

    if (!$input) {
        throw new Exception('Invalid input');
    }

    $type = $input['type'] ?? ''; // 'receive' or 'adjustment'
    $date = $input['transaction_date'] ?? date('Y-m-d H:i:s');
    $notes = $input['notes'] ?? '';
    // $proof_image = $input['proof_image'] ?? ''; // Handle image upload separately or pass URL
    $items = $input['items'] ?? [];
    $userId = $input['user_id'] ?? 1; // Default to admin if not provided

    if (empty($type) || empty($items)) {
        throw new Exception('Missing required fields');
    }

    $pdo->beginTransaction();

    // 1. Generate Document Number
    $prefix = ($type === 'receive') ? 'REC' : 'AJ';
    $datePart = date('ymd', strtotime($date));
    $pattern = $prefix . $datePart . '%';
    
    $stmt = $pdo->prepare("SELECT document_number FROM stock_transactions WHERE document_number LIKE ? ORDER BY id DESC LIMIT 1");
    $stmt->execute([$pattern]);
    $lastDoc = $stmt->fetchColumn();

    if ($lastDoc) {
        $lastNum = (int)substr($lastDoc, -5); // Extract last 5 digits
        $newNum = $lastNum + 1;
    } else {
        $newNum = 1;
    }
    $docNumber = $prefix . $datePart . '-' . str_pad($newNum, 5, '0', STR_PAD_LEFT);

    // Override if Manual Doc Number is provided for Receive? 
    // Plan said Allow Manual for Receive, but let's stick to Auto for consistency first unless requested.
    // Use user provided doc number if receive? Let's treat 'document_number' in input as optional override or external ref.
    if ($type === 'receive' && !empty($input['document_number_manual'])) {
         $docNumber = $input['document_number_manual'];
    }

    // 2. Create Transaction
    $stmt = $pdo->prepare("INSERT INTO stock_transactions (document_number, type, transaction_date, notes, created_by) VALUES (?, ?, ?, ?, ?)");
    $stmt->execute([$docNumber, $type, $date, $notes, $userId]);
    $transactionId = $pdo->lastInsertId();

    // 3. Process Items
    foreach ($items as $item) {
        $productId = $item['product_id'];
        $warehouseId = $item['warehouse_id'];
        $qty = (float)$item['quantity'];
        $lotId = $item['lot_id'] ?? null;
        $adjustmentType = $item['adjustment_type']; // 'add', 'reduce', 'receive'
        $remarks = $item['remarks'] ?? '';
        
        // Handle New Lot for Receive
        if ($type === 'receive' && empty($lotId) && !empty($item['new_lot_number'])) {
            $newLotNum = $item['new_lot_number'];
            $mfgDate = $item['mfg_date'] ?? null;
            $expDate = $item['exp_date'] ?? null;
            $cost = $item['cost_price'] ?? 0;
            
            // Note: mfg_date might need to be added to table. Using expiry_date, unit_cost as per existing schema.
            // quantity_initial -> quantity_received
            // Check if lot already exists first
            $chkLot = $pdo->prepare("SELECT id FROM product_lots WHERE lot_number = ? LIMIT 1");
            $chkLot->execute([$newLotNum]);
            $existingLotId = $chkLot->fetchColumn();

            if ($existingLotId) {
                // If exists, treat as update (Receive more into same lot)
                $stmtUpdateLot = $pdo->prepare("UPDATE product_lots SET quantity_remaining = quantity_remaining + ?, quantity_received = quantity_received + ? WHERE id = ?");
                $stmtUpdateLot->execute([$qty, $qty, $existingLotId]);
                $lotId = $existingLotId;
            } else {
                // If not exists, insert new
                $stmtLot = $pdo->prepare("INSERT INTO product_lots (product_id, lot_number, warehouse_id, quantity_received, quantity_remaining, expiry_date, unit_cost, purchase_date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Active')");
                $stmtLot->execute([$productId, $newLotNum, $warehouseId, $qty, $qty, $expDate, $cost, date('Y-m-d', strtotime($date))]);
                $lotId = $pdo->lastInsertId();
            }
            
            // Update Adjustment Type to be consistent
             $adjustmentType = 'receive';

        } elseif ($type === 'receive' && !empty($lotId)) {
             $adjustmentType = 'receive';
             // Existing Lot Receive - Update Quantity
             $stmtUpdateLot = $pdo->prepare("UPDATE product_lots SET quantity_remaining = quantity_remaining + ?, quantity_received = quantity_received + ? WHERE id = ?");
             $stmtUpdateLot->execute([$qty, $qty, $lotId]);
        } elseif ($type === 'adjustment') {
             if (empty($lotId)) throw new Exception("Lot ID required for adjustment");
             
             if ($adjustmentType === 'add') {
                 $stmtUpdateLot = $pdo->prepare("UPDATE product_lots SET quantity_remaining = quantity_remaining + ? WHERE id = ?");
                 $stmtUpdateLot->execute([$qty, $lotId]);
             } elseif ($adjustmentType === 'reduce') {
                 $stmtUpdateLot = $pdo->prepare("UPDATE product_lots SET quantity_remaining = quantity_remaining - ? WHERE id = ?");
                 $stmtUpdateLot->execute([$qty, $lotId]);
                 // Check negative?
                 // $stmtCheck = $pdo->prepare("SELECT quantity_remaining FROM product_lots WHERE id = ?");
                 // ...
             }
        }

        // Update Warehouse Stocks (Summary table if exists, usually warehouse_stocks table)
        // Update Warehouse Stocks (Summary table if exists, usually warehouse_stocks table)
        // Check if warehouse_stocks entry exists for (product_id, warehouse_id, lot_number)
        
        // Determine correct lot number string for warehouse_stocks
        $currentLotNumber = null;
        if (!empty($item['new_lot_number'])) {
            $currentLotNumber = $item['new_lot_number'];
        } elseif (!empty($lotId)) {
             $stmtGetLot = $pdo->prepare("SELECT lot_number FROM product_lots WHERE id = ?");
             $stmtGetLot->execute([$lotId]);
             $currentLotNumber = $stmtGetLot->fetchColumn();
        }

        $stockChange = ($adjustmentType === 'reduce') ? -$qty : $qty;

        if ($currentLotNumber) {
            $stmtChkStock = $pdo->prepare("SELECT id FROM warehouse_stocks WHERE product_id = ? AND warehouse_id = ? AND lot_number = ?");
            $stmtChkStock->execute([$productId, $warehouseId, $currentLotNumber]);
        } else {
             $stmtChkStock = $pdo->prepare("SELECT id FROM warehouse_stocks WHERE product_id = ? AND warehouse_id = ? AND lot_number IS NULL");
             $stmtChkStock->execute([$productId, $warehouseId]);
        }
        
        $stockExists = $stmtChkStock->fetchColumn();

        if ($stockExists) {
            $stmtStock = $pdo->prepare("UPDATE warehouse_stocks SET quantity = quantity + ? WHERE id = ?");
            $stmtStock->execute([$stockChange, $stockExists]);
        } else {
            if ($stockChange < 0) {
                 // Allow negative inventory? For now, let's warn or allow. 
                 // If rigorous check needed: throw new Exception("Cannot reduce stock for non-existent warehouse entry");
                 // But creating negative stock entry is sometimes better for sync issues. 
                 // Let's create it.
            }
            $stmtStock = $pdo->prepare("INSERT INTO warehouse_stocks (product_id, warehouse_id, quantity, lot_number, product_lot_id) VALUES (?, ?, ?, ?, ?)");
            $stmtStock->execute([$productId, $warehouseId, $stockChange, $currentLotNumber, $lotId]);
        }

        // Insert Item Record
        $stmtItem = $pdo->prepare("INSERT INTO stock_transaction_items (transaction_id, product_id, warehouse_id, lot_id, quantity, adjustment_type, remarks) VALUES (?, ?, ?, ?, ?, ?, ?)");
        $stmtItem->execute([$transactionId, $productId, $warehouseId, $lotId, $qty, $adjustmentType, $remarks]);

        // 5. Insert Stock Movement Log
        $moveType = ($type === 'receive') ? 'IN' : 'ADJUSTMENT';
        // For adjustment, refine type or just use ADJUSTMENT. 
        // If adjustment is reduce, quantity should be negative in movement log? 
        // Standard practice: IN/OUT defined by type. ADJUSTMENT usually tracks delta. 
        // Let's store signed quantity for ADJUSTMENT to be clear.
        $moveQty = ($adjustmentType === 'reduce') ? -$qty : $qty;
        
        $stmtMove = $pdo->prepare("INSERT INTO stock_movements (warehouse_id, product_id, movement_type, quantity, lot_number, document_number, reference_type, reference_id, reason, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $lotNumForLog = $item['new_lot_number'] ?? (
            $lotId ? $pdo->query("SELECT lot_number FROM product_lots WHERE id = $lotId")->fetchColumn() : null
        );
        $stmtMove->execute([$warehouseId, $productId, $moveType, $moveQty, $lotNumForLog, $docNumber, 'stock_transactions', $transactionId, $notes, $userId]);
    }

    // 4. Handle Image Uploads
    if (isset($input['images']) && is_array($input['images'])) {
        $uploadDir = '../../uploads/proofs/';
        if (!file_exists($uploadDir)) {
            mkdir($uploadDir, 0777, true);
        }

        foreach ($input['images'] as $base64Image) {
            // Check if it's base64
            if (strpos($base64Image, 'base64,') !== false) {
                list($type, $data) = explode(';', $base64Image);
                list(, $data)      = explode(',', $data);
                $data = base64_decode($data);
                
                // Detect extension
                $ext = 'jpg'; // default
                if (strpos($type, 'png') !== false) $ext = 'png';
                elseif (strpos($type, 'jpeg') !== false) $ext = 'jpg';
                elseif (strpos($type, 'gif') !== false) $ext = 'gif';

                $fileName = 'proof_' . $transactionId . '_' . uniqid() . '.' . $ext;
                $filePath = $uploadDir . $fileName;

                if (file_put_contents($filePath, $data)) {
                    $dbPath = 'uploads/proofs/' . $fileName;
                    $stmtImg = $pdo->prepare("INSERT INTO stock_transaction_images (transaction_id, image_path) VALUES (?, ?)");
                    $stmtImg->execute([$transactionId, $dbPath]);
                }
            }
        }
    }

    $pdo->commit();

    echo json_encode(['success' => true, 'document_number' => $docNumber]);

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
