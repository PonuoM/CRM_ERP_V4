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


