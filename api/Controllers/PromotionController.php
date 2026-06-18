<?php

function handle_promotions(PDO $pdo, ?string $id): void
{
    // Authenticate
    $user = get_authenticated_user($pdo);
    if (!$user) {
        json_response(['error' => 'UNAUTHORIZED'], 401);
    }
    $companyId = $user['company_id'];

    switch (method()) {
        case 'GET':
            if ($id) {
                // Get single promotion with items
                $stmt = $pdo->prepare('SELECT p.*, EXISTS(SELECT 1 FROM order_items oi WHERE oi.promotion_id = p.id) as is_used FROM promotions p WHERE p.id = ?');
                $stmt->execute([$id]);
                $promo = $stmt->fetch();
                if (!$promo) {
                    json_response(['error' => 'NOT_FOUND'], 404);
                    return;
                }
                // Fetch promotion items with product details
                $itemsStmt = $pdo->prepare('
                    SELECT pi.*, p.sku, p.name as product_name, p.price as product_price
                    FROM promotion_items pi
                    LEFT JOIN products p ON pi.product_id = p.id
                    WHERE pi.promotion_id = ?
                ');
                $itemsStmt->execute([$id]);
                $promo['items'] = $itemsStmt->fetchAll();
                json_response($promo);
            } else {
                // Get all promotions with items (both active and inactive)
                $sql = 'SELECT p.*, EXISTS(SELECT 1 FROM order_items oi WHERE oi.promotion_id = p.id) as is_used FROM promotions p WHERE p.company_id = ? ORDER BY p.id DESC';
                $params = [$companyId];

                $stmt = $pdo->prepare($sql);
                if (!empty($params)) {
                    $stmt->execute($params);
                } else {
                    $stmt->execute();
                }
                $promos = $stmt->fetchAll();

                // Fetch items for each promotion
                foreach ($promos as &$promo) {
                    $itemsStmt = $pdo->prepare('
                        SELECT pi.*, p.sku, p.name as product_name, p.price as product_price
                        FROM promotion_items pi
                        LEFT JOIN products p ON pi.product_id = p.id
                        WHERE pi.promotion_id = ?
                    ');
                    $itemsStmt->execute([$promo['id']]);
                    $promo['items'] = $itemsStmt->fetchAll();
                }
                json_response($promos);
            }
            break;
        case 'POST':
            $in = json_input();
            if (!$in || !is_array($in)) {
                $in = [];
            }

            $name = trim((string) ($in['name'] ?? ''));
            $sku = trim((string) ($in['sku'] ?? ''));
            $description = trim((string) ($in['description'] ?? ''));
            $companyId = (int) ($in['company_id'] ?? $in['companyId'] ?? 1);
            $active = (int) ($in['active'] ?? 1);
            $startDate = $in['start_date'] ?? $in['startDate'] ?? null;
            $endDate = $in['end_date'] ?? $in['endDate'] ?? null;

            // Convert empty strings to null
            if ($startDate === '')
                $startDate = null;
            if ($endDate === '')
                $endDate = null;
            $items = $in['items'] ?? [];

            if ($name === '') {
                json_response(['error' => 'VALIDATION_FAILED', 'message' => 'name is required'], 400);
            }

            $pdo->beginTransaction();
            try {
                // Insert promotion
                $stmt = $pdo->prepare('INSERT INTO promotions (name, sku, description, company_id, active, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?, ?)');
                $stmt->execute([$name, $sku, $description, $companyId, $active, $startDate, $endDate]);
                $promotionId = (int) $pdo->lastInsertId();

                // Insert promotion items
                if (!empty($items) && is_array($items)) {
                    $itemStmt = $pdo->prepare('INSERT INTO promotion_items (promotion_id, product_id, quantity, is_freebie, price_override) VALUES (?, ?, ?, ?, ?)');
                    foreach ($items as $item) {
                        $itemStmt->execute([
                            $promotionId,
                            (int) ($item['product_id'] ?? $item['productId'] ?? 0),
                            (int) ($item['quantity'] ?? 1),
                            (int) ($item['is_freebie'] ?? $item['isFreebie'] ?? 0),
                            $item['price_override'] ?? $item['priceOverride'] ?? null
                        ]);
                    }
                }

                $pdo->commit();

                // Return the created promotion with items
                $stmt = $pdo->prepare('SELECT * FROM promotions WHERE id = ?');
                $stmt->execute([$promotionId]);
                $promo = $stmt->fetch();

                $itemsStmt = $pdo->prepare('
                    SELECT pi.*, p.sku, p.name as product_name, p.price as product_price
                    FROM promotion_items pi
                    LEFT JOIN products p ON pi.product_id = p.id
                    WHERE pi.promotion_id = ?
                ');
                $itemsStmt->execute([$promotionId]);
                $promo['items'] = $itemsStmt->fetchAll();

                json_response($promo, 201);
            } catch (Throwable $e) {
                $pdo->rollBack();
                json_response(['error' => 'CREATE_FAILED', 'message' => $e->getMessage()], 500);
            }
            break;
        case 'PUT':
        case 'PATCH':
            if (!$id)
                json_response(['error' => 'ID_REQUIRED'], 400);

            $in = json_input();
            if (!$in || !is_array($in)) {
                $in = [];
            }

            // Check if promotion is used in any orders
            $isPromotionInUse = false;
            $check = $pdo->prepare('SELECT COUNT(*) FROM order_items WHERE promotion_id = ?');
            $check->execute([$id]);
            if ($check->fetchColumn() > 0) {
                $isPromotionInUse = true;
            }

            $pdo->beginTransaction();
            try {
                // Update promotion
                $fields = [];
                $params = [];
                $map = [
                    'name' => 'name',
                    'sku' => 'sku',
                    'description' => 'description',
                    'company_id' => 'company_id',
                    'companyId' => 'company_id',
                    'active' => 'active',
                    'start_date' => 'start_date',
                    'startDate' => 'start_date',
                    'end_date' => 'end_date',
                    'endDate' => 'end_date'
                ];

                foreach ($map as $inKey => $col) {
                    if (array_key_exists($inKey, $in)) {
                        $value = $in[$inKey];
                        // Convert empty strings to null for date fields
                        if (($col === 'start_date' || $col === 'end_date') && $value === '') {
                            $value = null;
                        }
                        $fields[] = "$col = ?";
                        $params[] = $value;
                    }
                }

                if (!empty($fields)) {
                    $params[] = $id;
                    $stmt = $pdo->prepare('UPDATE promotions SET ' . implode(', ', $fields) . ' WHERE id = ?');
                    $stmt->execute($params);
                }

                // Update promotion items if provided AND not in use
                if (!$isPromotionInUse && isset($in['items']) && is_array($in['items'])) {
                    // Delete existing items
                    $pdo->prepare('DELETE FROM promotion_items WHERE promotion_id = ?')->execute([$id]);

                    // Insert new items
                    $itemStmt = $pdo->prepare('INSERT INTO promotion_items (promotion_id, product_id, quantity, is_freebie, price_override) VALUES (?, ?, ?, ?, ?)');
                    foreach ($in['items'] as $item) {
                        $itemStmt->execute([
                            $id,
                            (int) ($item['product_id'] ?? $item['productId'] ?? 0),
                            (int) ($item['quantity'] ?? 1),
                            (int) ($item['is_freebie'] ?? $item['isFreebie'] ?? 0),
                            $item['price_override'] ?? $item['priceOverride'] ?? null
                        ]);
                    }
                }

                $pdo->commit();

                // Return updated promotion
                $stmt = $pdo->prepare('SELECT * FROM promotions WHERE id = ?');
                $stmt->execute([$id]);
                $promo = $stmt->fetch();

                $itemsStmt = $pdo->prepare('
                    SELECT pi.*, p.sku, p.name as product_name, p.price as product_price
                    FROM promotion_items pi
                    LEFT JOIN products p ON pi.product_id = p.id
                    WHERE pi.promotion_id = ?
                ');
                $itemsStmt->execute([$id]);
                $promo['items'] = $itemsStmt->fetchAll();

                json_response($promo);
            } catch (Throwable $e) {
                $pdo->rollBack();
                json_response(['error' => 'UPDATE_FAILED', 'message' => $e->getMessage()], 500);
            }
            break;
        case 'DELETE':
            if (!$id)
                json_response(['error' => 'ID_REQUIRED'], 400);

            // Check if promotion is used in any orders
            $check = $pdo->prepare('SELECT COUNT(*) FROM order_items WHERE promotion_id = ?');
            $check->execute([$id]);
            if ($check->fetchColumn() > 0) {
                json_response([
                    'error' => 'PROMOTION_IN_USE',
                    'message' => 'ไม่สามารถลบโปรโมชั่นที่มีการสั่งซื้อแล้ว กรุณาปิดใช้งานแทน'
                ], 400);
                return;
            }

            try {
                $stmt = $pdo->prepare('DELETE FROM promotions WHERE id = ?');
                $stmt->execute([$id]);
                json_response(['ok' => true]);
            } catch (Throwable $e) {
                json_response(['error' => 'DELETE_FAILED', 'message' => $e->getMessage()], 500);
            }
            break;
        default:
            json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }
}

function format_decimal_quantity($qty): string
{
    return number_format((float) $qty, 2, '.', '');
}

function ensure_warehouse_matches_company(PDO $pdo, int $warehouseId, ?int $companyId): void
{
    if ($companyId === null) {
        return;
    }
    $stmt = $pdo->prepare('SELECT company_id FROM warehouses WHERE id = ?');
    $stmt->execute([$warehouseId]);
    $found = $stmt->fetchColumn();
    if ($found === false) {
        throw new RuntimeException('WAREHOUSE_NOT_FOUND');
    }
    if ((int) $found !== (int) $companyId) {
        throw new RuntimeException('WAREHOUSE_COMPANY_MISMATCH');
    }
}

function reserve_stock_for_allocation(PDO $pdo, int $warehouseId, int $productId, ?string $lotNumber, int $quantity): void
{
    $sel = $pdo->prepare('SELECT id FROM warehouse_stocks WHERE warehouse_id=? AND product_id=? AND ((lot_number IS NULL AND ? IS NULL) OR lot_number = ?) LIMIT 1 FOR UPDATE');
    $sel->execute([$warehouseId, $productId, $lotNumber, $lotNumber]);
    $row = $sel->fetch(PDO::FETCH_ASSOC);
    if ($row) {
        $upd = $pdo->prepare('UPDATE warehouse_stocks SET reserved_quantity = GREATEST(0, reserved_quantity + ?) WHERE id=?');
        $upd->execute([$quantity, (int) $row['id']]);
    } else {
        $ins = $pdo->prepare('INSERT INTO warehouse_stocks (warehouse_id, product_id, lot_number, quantity, reserved_quantity) VALUES (?,?,?,?,?)');
        $ins->execute([$warehouseId, $productId, $lotNumber, 0, max(0, $quantity)]);
    }
}

function release_stock_for_allocation(PDO $pdo, int $warehouseId, int $productId, ?string $lotNumber, int $quantity): void
{
    $stmt = $pdo->prepare('UPDATE warehouse_stocks SET reserved_quantity = GREATEST(0, reserved_quantity - ?) WHERE warehouse_id=? AND product_id=? AND ((lot_number IS NULL AND ? IS NULL) OR lot_number = ?) LIMIT 1');
    $stmt->execute([$quantity, $warehouseId, $productId, $lotNumber, $lotNumber]);
}

function release_single_allocation(PDO $pdo, array $allocationRow, string $statusOnRelease = 'PENDING'): ?array
{
    $releasedQty = (int) $allocationRow['allocated_quantity'];
    $lotNumber = $allocationRow['lot_number'] !== null ? (string) $allocationRow['lot_number'] : null;
    $warehouseId = $allocationRow['warehouse_id'] !== null ? (int) $allocationRow['warehouse_id'] : null;

    if ($releasedQty > 0 && $lotNumber && $warehouseId) {
        $pdo->prepare('UPDATE product_lots SET quantity_remaining = quantity_remaining + ? WHERE lot_number = ? AND product_id = ? AND warehouse_id = ?')
            ->execute([format_decimal_quantity($releasedQty), $lotNumber, (int) $allocationRow['product_id'], $warehouseId]);
    }

    if ($releasedQty > 0 && $warehouseId) {
        release_stock_for_allocation($pdo, $warehouseId, (int) $allocationRow['product_id'], $lotNumber, $releasedQty);
    }

    // Reset allocation fields regardless of released quantity to keep state consistent
    $pdo->prepare('UPDATE order_item_allocations SET allocated_quantity = 0, lot_number = NULL, warehouse_id = NULL, status = ? WHERE id = ?')
        ->execute([$statusOnRelease, (int) $allocationRow['id']]);

    if ($releasedQty <= 0 && !$lotNumber) {
        return null;
    }


    // Log Stock Movement (IN - Reversal)
    if ($releasedQty > 0) {
        $pdo->prepare("INSERT INTO stock_movements (warehouse_id, product_id, movement_type, quantity, lot_number, document_number, reference_type, reference_id, reason, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
            ->execute([$warehouseId ?? 0, (int) $allocationRow['product_id'], 'IN', $releasedQty, $lotNumber, $allocationRow['order_id'] ?? 'N/A', 'order_item_allocations', (int) $allocationRow['id'], 'Allocation Released', 1]);
    }

    return [
        'allocationId' => (int) $allocationRow['id'],
        'releasedQuantity' => $releasedQty,
        'lotNumber' => $lotNumber,
    ];
}

function allocate_allocation_fifo(PDO $pdo, array $allocationRow, int $warehouseId, ?int $desiredQuantity = null, ?string $preferredLot = null): array
{
    $required = $desiredQuantity !== null ? max(0, (int) $desiredQuantity) : max(0, (int) $allocationRow['required_quantity']);
    if ($required <= 0) {
        return [];
    }

    if ((int) $allocationRow['allocated_quantity'] > 0 && !empty($allocationRow['lot_number'])) {
        release_single_allocation($pdo, $allocationRow);
    }

    if ($preferredLot !== null && $preferredLot !== '') {
        $lotStmt = $pdo->prepare('SELECT id, lot_number, quantity_remaining FROM product_lots WHERE product_id=? AND warehouse_id=? AND status = \'Active\' AND quantity_remaining > 0 AND lot_number = ? ORDER BY purchase_date ASC, id ASC FOR UPDATE');
        $lotStmt->execute([(int) $allocationRow['product_id'], $warehouseId, $preferredLot]);
    } else {
        $lotStmt = $pdo->prepare('SELECT id, lot_number, quantity_remaining FROM product_lots WHERE product_id=? AND warehouse_id=? AND status = \'Active\' AND quantity_remaining > 0 ORDER BY purchase_date ASC, id ASC FOR UPDATE');
        $lotStmt->execute([(int) $allocationRow['product_id'], $warehouseId]);
    }
    $lots = $lotStmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($lots as $lot) {
        if ((float) $lot['quantity_remaining'] + 1e-6 < $required) {
            continue;
        }
        $qtyDecimal = format_decimal_quantity($required);
        $updateLot = $pdo->prepare('UPDATE product_lots SET quantity_remaining = quantity_remaining - ? WHERE id = ? AND quantity_remaining >= ?');
        $updateLot->execute([$qtyDecimal, (int) $lot['id'], $qtyDecimal]);
        if ($updateLot->rowCount() === 0) {
            continue;
        }

        reserve_stock_for_allocation($pdo, $warehouseId, (int) $allocationRow['product_id'], (string) $lot['lot_number'], $required);

        $pdo->prepare('UPDATE order_item_allocations SET warehouse_id=?, lot_number=?, allocated_quantity=?, status=? WHERE id=?')
            ->execute([$warehouseId, (string) $lot['lot_number'], $required, 'ALLOCATED', (int) $allocationRow['id']]);

        // [LOGGING] Log Stock Movement (OUT) so it appears in reports
        $pdo->prepare("INSERT INTO stock_movements (warehouse_id, product_id, movement_type, quantity, lot_number, document_number, reference_type, reference_id, reason, created_by, created_at) VALUES (?, ?, 'OUT', ?, ?, ?, 'order_item_allocations', ?, 'Order Allocation', ?, NOW())")
            ->execute([
                $warehouseId,
                (int) $allocationRow['product_id'],
                $required,
                (string) $lot['lot_number'],
                $allocationRow['order_id'] ?? 'N/A',
                (int) $allocationRow['id'],
                $allocationRow['created_by'] ?? 1
            ]);

        return [
            'allocationId' => (int) $allocationRow['id'],
            'lotNumber' => (string) $lot['lot_number'],
            'allocatedQuantity' => $required,
        ];
    }

    return [];
}

function allocate_allocation_fifo_allow_negative(PDO $pdo, array $allocationRow, int $warehouseId, ?int $desiredQuantity = null, ?string $preferredLot = null): array
{
    $required = $desiredQuantity !== null ? max(0, (int) $desiredQuantity) : max(0, (int) $allocationRow['required_quantity']);
    if ($required <= 0) {
        return [];
    }

    if ((int) $allocationRow['allocated_quantity'] > 0 && !empty($allocationRow['lot_number'])) {
        release_single_allocation($pdo, $allocationRow);
    }

    // Try to allocate with available stock first (FIFO)
    if ($preferredLot !== null && $preferredLot !== '') {
        $lotStmt = $pdo->prepare('SELECT id, lot_number, quantity_remaining FROM product_lots WHERE product_id=? AND warehouse_id=? AND status = \'Active\' AND quantity_remaining > 0 AND lot_number = ? ORDER BY purchase_date ASC, id ASC FOR UPDATE');
        $lotStmt->execute([(int) $allocationRow['product_id'], $warehouseId, $preferredLot]);
    } else {
        $lotStmt = $pdo->prepare('SELECT id, lot_number, quantity_remaining FROM product_lots WHERE product_id=? AND warehouse_id=? AND status = \'Active\' AND quantity_remaining > 0 ORDER BY purchase_date ASC, id ASC FOR UPDATE');
        $lotStmt->execute([(int) $allocationRow['product_id'], $warehouseId]);
    }
    $lots = $lotStmt->fetchAll(PDO::FETCH_ASSOC);

    // Try to allocate with available stock
    foreach ($lots as $lot) {
        if ((float) $lot['quantity_remaining'] + 1e-6 < $required) {
            continue;
        }
        $qtyDecimal = format_decimal_quantity($required);
        $updateLot = $pdo->prepare('UPDATE product_lots SET quantity_remaining = quantity_remaining - ? WHERE id = ? AND quantity_remaining >= ?');
        $updateLot->execute([$qtyDecimal, (int) $lot['id'], $qtyDecimal]);
        if ($updateLot->rowCount() === 0) {
            continue;
        }

        reserve_stock_for_allocation($pdo, $warehouseId, (int) $allocationRow['product_id'], (string) $lot['lot_number'], $required);

        $pdo->prepare('UPDATE order_item_allocations SET warehouse_id=?, lot_number=?, allocated_quantity=?, status=? WHERE id=?')
            ->execute([$warehouseId, (string) $lot['lot_number'], $required, 'ALLOCATED', (int) $allocationRow['id']]);

        // Log Stock Movement (OUT)
        $pdo->prepare("INSERT INTO stock_movements (warehouse_id, product_id, movement_type, quantity, lot_number, document_number, reference_type, reference_id, reason, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
            ->execute([$warehouseId, (int) $allocationRow['product_id'], 'OUT', -$required, (string) $lot['lot_number'], $allocationRow['order_id'] ?? 'N/A', 'order_item_allocations', (int) $allocationRow['id'], 'Order Allocation', 1]);

        return [
            'allocationId' => (int) $allocationRow['id'],
            'lotNumber' => (string) $lot['lot_number'],
            'allocatedQuantity' => $required,
        ];
    }

    // If no sufficient stock, allow negative allocation (for companies not using warehouse system)
    // Use the first available lot or create a virtual allocation
    $lotForNegative = null;
    if ($preferredLot !== null && $preferredLot !== '') {
        $lotStmtNeg = $pdo->prepare('SELECT id, lot_number, quantity_remaining FROM product_lots WHERE product_id=? AND warehouse_id=? AND status = \'Active\' AND lot_number = ? ORDER BY purchase_date ASC, id ASC LIMIT 1');
        $lotStmtNeg->execute([(int) $allocationRow['product_id'], $warehouseId, $preferredLot]);
        $lotForNegative = $lotStmtNeg->fetch(PDO::FETCH_ASSOC);
    }

    if (!$lotForNegative) {
        $lotStmtNeg = $pdo->prepare('SELECT id, lot_number, quantity_remaining FROM product_lots WHERE product_id=? AND warehouse_id=? AND status = \'Active\' ORDER BY purchase_date ASC, id ASC LIMIT 1');
        $lotStmtNeg->execute([(int) $allocationRow['product_id'], $warehouseId]);
        $lotForNegative = $lotStmtNeg->fetch(PDO::FETCH_ASSOC);
    }

    $lotNumberToUse = $lotForNegative ? (string) $lotForNegative['lot_number'] : '__VIRTUAL__';

    // Update lot to negative if exists, otherwise just allocate without stock check
    if ($lotForNegative) {
        $qtyDecimal = format_decimal_quantity($required);
        $updateLotNeg = $pdo->prepare('UPDATE product_lots SET quantity_remaining = quantity_remaining - ? WHERE id = ?');
        $updateLotNeg->execute([$qtyDecimal, (int) $lotForNegative['id']]);
    }

    reserve_stock_for_allocation($pdo, $warehouseId, (int) $allocationRow['product_id'], $lotNumberToUse !== '__VIRTUAL__' ? $lotNumberToUse : null, $required);

    $pdo->prepare('UPDATE order_item_allocations SET warehouse_id=?, lot_number=?, allocated_quantity=?, status=? WHERE id=?')
        ->execute([$warehouseId, $lotNumberToUse !== '__VIRTUAL__' ? $lotNumberToUse : null, $required, 'ALLOCATED', (int) $allocationRow['id']]);

    // Log Stock Movement (OUT)
    $pdo->prepare("INSERT INTO stock_movements (warehouse_id, product_id, movement_type, quantity, lot_number, document_number, reference_type, reference_id, reason, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        ->execute([$warehouseId, (int) $allocationRow['product_id'], 'OUT', -$required, $lotNumberToUse !== '__VIRTUAL__' ? $lotNumberToUse : null, $allocationRow['order_id'] ?? 'N/A', 'order_item_allocations', (int) $allocationRow['id'], 'Order Allocation (Negative)', 1]);

    return [
        'allocationId' => (int) $allocationRow['id'],
        'lotNumber' => $lotNumberToUse !== '__VIRTUAL__' ? $lotNumberToUse : null,
        'allocatedQuantity' => $required,
    ];
}

function auto_allocate_order(PDO $pdo, string $orderId, int $warehouseId, ?int $companyId = null): array
{
    if ($warehouseId <= 0) {
        throw new RuntimeException('WAREHOUSE_REQUIRED');
    }

    ensure_warehouse_matches_company($pdo, $warehouseId, $companyId);

    $stmt = $pdo->prepare('SELECT * FROM order_item_allocations WHERE order_id=? AND status IN (\'PENDING\', \'ALLOCATED\') ORDER BY id FOR UPDATE');
    $stmt->execute([$orderId]);
    $allocations = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (!$allocations) {
        return [];
    }

    $allocated = [];
    $failures = [];
    foreach ($allocations as $allocation) {
        $required = (int) $allocation['required_quantity'];
        if ($required <= 0) {
            continue;
        }
        if (
            strcasecmp((string) $allocation['status'], 'ALLOCATED') === 0 &&
            (int) $allocation['allocated_quantity'] >= $required &&
            !empty($allocation['lot_number'])
        ) {
            continue;
        }
        $result = allocate_allocation_fifo($pdo, $allocation, $warehouseId, $required);
        if ($result) {
            $allocated[] = $result;
        } else {
            $failures[] = [
                'allocationId' => (int) $allocation['id'],
                'productId' => (int) $allocation['product_id'],
                'required' => $required,
            ];
        }
    }

    if ($failures) {
        $messages = array_map(static function (array $row): string {
            return $row['productId'] . ':' . $row['required'];
        }, $failures);
        throw new RuntimeException('INSUFFICIENT_STOCK ' . implode(',', $messages));
    }

    return $allocated;
}

function release_order_allocations(PDO $pdo, string $orderId): array
{
    $stmt = $pdo->prepare('SELECT * FROM order_item_allocations WHERE order_id=? AND allocated_quantity > 0 AND status IN (\'ALLOCATED\', \'PICKED\', \'SHIPPED\') ORDER BY id FOR UPDATE');
    $stmt->execute([$orderId]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    if (!$rows) {
        return [];
    }
    $released = [];
    foreach ($rows as $row) {
        $info = release_single_allocation($pdo, $row, 'CANCELLED');
        if ($info) {
            $released[] = $info;
        }
    }
    return $released;
}

function calculate_order_item_net_total(array $item): float
{
    $quantity = isset($item['quantity']) ? (int) $item['quantity'] : 0;
    $quantity = $quantity < 0 ? 0 : $quantity;
    $pricePerUnit = isset($item['pricePerUnit']) ? (float) $item['pricePerUnit'] : (float) ($item['price_per_unit'] ?? 0);
    $pricePerUnit = $pricePerUnit < 0 ? 0.0 : $pricePerUnit;
    $discount = isset($item['discount']) ? (float) $item['discount'] : 0.0;
    $isFreebie = !empty($item['isFreebie']) || (!empty($item['is_freebie']) && (int) $item['is_freebie'] === 1);
    if ($isFreebie) {
        return 0.0;
    }
    $net = ($pricePerUnit * $quantity) - $discount;
    return $net > 0 ? $net : 0.0;
}

