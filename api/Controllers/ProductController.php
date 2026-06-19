<?php

function handle_products(PDO $pdo, ?string $id): void
{
    switch (method()) {
        case 'GET':
            if ($id) {
                // Check if requesting total stock
                if (strpos($_SERVER['REQUEST_URI'], '/total_stock') !== false) {
                    $stmt = $pdo->prepare('
                        SELECT COALESCE(SUM(quantity), 0) as total_stock
                        FROM warehouse_stocks
                        WHERE product_id = ?
                    ');
                    $stmt->execute([$id]);
                    $result = $stmt->fetch();
                    json_response(['total_stock' => $result['total_stock']]);
                    return;
                }

                if ($id === 'check_duplicate_skus') {
                    $companyId = $_GET['company_id'] ?? null;
                    if (!$companyId) {
                        json_response(["success" => false, "error" => "Missing company_id"], 400);
                    }
                    $stmt = $pdo->prepare("
                        SELECT sku, COUNT(*) as count, GROUP_CONCAT(source) as sources, GROUP_CONCAT(name SEPARATOR ' || ') as names
                        FROM (
                            SELECT sku, 'product' as source, name FROM products WHERE company_id = ? AND sku IS NOT NULL AND sku != ''
                            UNION ALL
                            SELECT sku, 'promotion' as source, name FROM promotions WHERE company_id = ? AND sku IS NOT NULL AND sku != ''
                        ) as all_skus
                        GROUP BY sku
                        HAVING COUNT(*) > 1
                    ");
                    $stmt->execute([$companyId, $companyId]);
                    $duplicates = $stmt->fetchAll(PDO::FETCH_ASSOC);
                    json_response(["success" => true, "duplicates" => $duplicates]);
                }

                $stmt = $pdo->prepare('SELECT * FROM products WHERE id = ?');
                $stmt->execute([$id]);
                $row = $stmt->fetch();
                $row ? json_response($row) : json_response(['error' => 'NOT_FOUND'], 404);
            } else {
                $companyId = $_GET['companyId'] ?? null;
                $include = $_GET['include'] ?? '';
                $includeJstStock = !empty($_GET['include_jst_stock']);

                if ($includeJstStock) {
                    $sql = '
                        SELECT p.*, j.total_available_qty as jst_stock, j.total_order_lock as jst_lock
                        FROM products p
                        LEFT JOIN (
                            SELECT sku_id, company_id, SUM(available_qty) as total_available_qty, SUM(order_lock) as total_order_lock
                            FROM jst_inventory
                            GROUP BY sku_id, company_id
                        ) j ON COALESCE(NULLIF(p.jst_sku, \'\'), p.sku) = j.sku_id AND p.company_id = j.company_id
                        WHERE (p.deleted_at IS NULL)
                    ';
                } else {
                    $sql = 'SELECT p.* FROM products p WHERE (p.deleted_at IS NULL)';
                }

                if ($include !== 'inactive') {
                    $sql .= ' AND (p.status = "Active" OR p.status IS NULL OR p.status = "" OR p.status = "1")';
                }

                $params = [];
                if ($companyId) {
                    $sql .= ' AND p.company_id = ?';
                    $params[] = $companyId;
                }
                $sql .= ' ORDER BY p.id DESC';
                
                $stmt = $pdo->prepare($sql);
                if (!empty($params)) {
                    $stmt->execute($params);
                } else {
                    $stmt->execute();
                }
                json_response($stmt->fetchAll());
            }
            break;
        case 'POST':
            $in = json_input();
            $stmt = $pdo->prepare('INSERT INTO products (sku, jst_sku, name, description, category, unit, cost, price, stock, company_id, shop, status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
            $stmt->execute([
                $in['sku'] ?? '',
                $in['jst_sku'] ?? null,
                $in['name'] ?? '',
                $in['description'] ?? null,
                $in['category'] ?? '',
                $in['unit'] ?? '',
                $in['cost'] ?? 0,
                $in['price'] ?? 0,
                $in['stock'] ?? 0,
                $in['companyId'] ?? null,
                $in['shop'] ?? null,
                $in['status'] ?? 'Active'
            ]);
            json_response(['id' => $pdo->lastInsertId()]);
            break;
        case 'PATCH':
            if (!$id)
                json_response(['error' => 'ID_REQUIRED'], 400);
            $in = json_input();
            $fields = [];
            $params = [];
            $map = [
                'sku' => 'sku',
                'name' => 'name',
                'description' => 'description',
                'category' => 'category',
                'unit' => 'unit',
                'cost' => 'cost',
                'price' => 'price',
                'stock' => 'stock',
                'status' => 'status',
                'companyId' => 'company_id',
                'shop' => 'shop',
                'jst_sku' => 'jst_sku'
            ];
            foreach ($map as $inKey => $col) {
                if (array_key_exists($inKey, $in)) {
                    $fields[] = "$col = ?";
                    $params[] = $in[$inKey];
                }
            }
            if (empty($fields)) {
                json_response(['ok' => true]);
            }
            $params[] = $id;
            try {
                $sql = 'UPDATE products SET ' . implode(', ', $fields) . ' WHERE id = ?';
                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
                $get = $pdo->prepare('SELECT * FROM products WHERE id = ?');
                $get->execute([$id]);
                $row = $get->fetch();
                $row ? json_response($row) : json_response(['error' => 'NOT_FOUND'], 404);
            } catch (Throwable $e) {
                json_response(['error' => 'UPDATE_FAILED', 'message' => $e->getMessage()], 500);
            }
            break;
        default:
            json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }
}

