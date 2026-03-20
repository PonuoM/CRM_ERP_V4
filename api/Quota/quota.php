<?php
/**
 * Product Quota System API
 * 
 * Endpoints:
 * GET  ?action=list_products&companyId=X
 * GET  ?action=get_rate&quotaProductId=X
 * GET  ?action=list_rates&quotaProductId=X
 * GET  ?action=calculate&quotaProductId=X&userId=Y
 * GET  ?action=list_allocations&quotaProductId=X&userId=Y
 * GET  ?action=summary&companyId=X&quotaProductId=Y
 * POST action=create_product
 * POST action=update_product
 * POST action=create_rate
 * POST action=allocate
 * POST action=use_quota
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/quota_record_helper.php';
cors();
$conn = db_connect();

$method = $_SERVER['REQUEST_METHOD'];

try {
    if ($method === 'GET') {
        $action = $_GET['action'] ?? '';
        
        switch ($action) {
            case 'list_products':
                handleListProducts($conn);
                break;
            case 'get_rate':
                handleGetRate($conn);
                break;
            case 'list_rates':
                handleListRates($conn);
                break;
            case 'calculate':
                handleCalculate($conn);
                break;
            case 'list_allocations':
                handleListAllocations($conn);
                break;
            case 'summary':
                handleSummary($conn);
                break;
            case 'summary_by_rate':
                handleSummaryByRate($conn);
                break;
            case 'user_quota_detail':
                handleUserQuotaDetail($conn);
                break;
            case 'pending_counts':
                handlePendingCounts($conn);
                break;
            default:
                json_response(['error' => 'Unknown action: ' . $action], 400);
        }
    } elseif ($method === 'POST') {
        $data = json_input();
        $action = $data['action'] ?? '';
        
        switch ($action) {
            case 'create_product':
                handleCreateProduct($conn, $data);
                break;
            case 'create_product_with_quota':
                handleCreateProductWithQuota($conn, $data);
                break;
            case 'update_product':
                handleUpdateProduct($conn, $data);
                break;
            case 'create_rate':
                handleCreateRate($conn, $data);
                break;
            case 'update_rate':
                handleUpdateRate($conn, $data);
                break;
            case 'delete_rate':
                handleDeleteRate($conn, $data);
                break;
            case 'allocate':
                handleAllocate($conn, $data);
                break;
            case 'use_quota':
                handleUseQuota($conn, $data);
                break;
            case 'confirm_quota':
                handleConfirmQuota($conn, $data);
                break;
            case 'bulk_confirm_quota':
                handleBulkConfirmQuota($conn, $data);
                break;
            case 'record_order_usage':
                handleRecordOrderUsage($conn, $data);
                break;
            default:
                json_response(['error' => 'Unknown action: ' . $action], 400);
        }
    } else {
        json_response(['error' => 'Method not allowed'], 405);
    }
} catch (Exception $e) {
    json_response(['error' => $e->getMessage()], 500);
}

// ============================================================
// GET Handlers
// ============================================================

function handleListProducts(PDO $conn) {
    $companyId = intval($_GET['companyId'] ?? 0);
    if (!$companyId) {
        json_response(['error' => 'companyId required'], 400);
    }

    $stmt = $conn->prepare("
        SELECT qp.*, p.name AS product_name, p.sku AS product_sku, p.price AS product_price
        FROM quota_products qp
        LEFT JOIN products p ON p.id = qp.product_id
        WHERE qp.company_id = :companyId AND qp.deleted_at IS NULL
        ORDER BY qp.is_active DESC, qp.display_name ASC
    ");
    $stmt->execute([':companyId' => $companyId]);
    $products = $stmt->fetchAll();

    json_response(['success' => true, 'data' => $products]);
}

function handleGetRate(PDO $conn) {
    $quotaProductId = intval($_GET['quotaProductId'] ?? 0);
    if (!$quotaProductId) {
        json_response(['error' => 'quotaProductId required'], 400);
    }

    $stmt = $conn->prepare("
        SELECT * FROM quota_rate_schedules
        WHERE quota_product_id = :qpId AND effective_date <= CURDATE() AND deleted_at IS NULL
        ORDER BY effective_date DESC
        LIMIT 1
    ");
    $stmt->execute([':qpId' => $quotaProductId]);
    $rate = $stmt->fetch();

    json_response(['success' => true, 'data' => $rate ?: null]);
}

function handleListRates(PDO $conn) {
    $companyId = intval($_GET['companyId'] ?? 0);
    if (!$companyId) {
        json_response(['error' => 'companyId required'], 400);
    }

    // Get all rates where any scope product belongs to this company
    $stmt = $conn->prepare("
        SELECT DISTINCT qrs.*, u.first_name AS created_by_name
        FROM quota_rate_schedules qrs
        LEFT JOIN users u ON u.id = qrs.created_by
        JOIN quota_rate_scope scope ON scope.rate_schedule_id = qrs.id
        JOIN quota_products qp ON qp.id = scope.quota_product_id AND qp.company_id = :companyId AND qp.deleted_at IS NULL
        WHERE qrs.deleted_at IS NULL
        ORDER BY qrs.effective_date DESC
    ");
    $stmt->execute([':companyId' => $companyId]);
    $rates = $stmt->fetchAll();

    // Attach scope_rates (per-product rates) for each rate
    foreach ($rates as &$rate) {
        $stmtScope = $conn->prepare("
            SELECT scope.quota_product_id, scope.sales_per_quota, qp.display_name
            FROM quota_rate_scope scope
            JOIN quota_products qp ON qp.id = scope.quota_product_id AND qp.deleted_at IS NULL
            WHERE scope.rate_schedule_id = :rid
        ");
        $stmtScope->execute([':rid' => $rate['id']]);
        $rate['scope_rates'] = $stmtScope->fetchAll(PDO::FETCH_ASSOC);
        // Also keep scope_product_ids for backward compat
        $rate['scope_product_ids'] = array_column($rate['scope_rates'], 'quota_product_id');
    }
    unset($rate);

    json_response(['success' => true, 'data' => $rates]);
}

function handleCalculate(PDO $conn) {
    $quotaProductId = intval($_GET['quotaProductId'] ?? 0);
    $userId = intval($_GET['userId'] ?? 0);
    if (!$quotaProductId || !$userId) {
        json_response(['error' => 'quotaProductId and userId required'], 400);
    }

    $result = calculateQuota($conn, $quotaProductId, $userId);
    json_response(['success' => true, 'data' => $result]);
}

function handleListAllocations(PDO $conn) {
    $quotaProductId = intval($_GET['quotaProductId'] ?? 0);
    $userId = intval($_GET['userId'] ?? 0);
    $companyId = intval($_GET['companyId'] ?? 0);

    $where = [];
    $params = [];

    if ($quotaProductId) {
        $where[] = 'qa.quota_product_id = :qpId';
        $params[':qpId'] = $quotaProductId;
    }
    if ($userId) {
        $where[] = 'qa.user_id = :userId';
        $params[':userId'] = $userId;
    }
    if ($companyId) {
        $where[] = 'qa.company_id = :companyId';
        $params[':companyId'] = $companyId;
    }

    $where[] = 'qa.deleted_at IS NULL';
    $whereClause = $where ? 'WHERE ' . implode(' AND ', $where) : '';

    $stmt = $conn->prepare("
        SELECT qa.*, 
            u.first_name AS user_first_name, u.last_name AS user_last_name,
            ab.first_name AS allocated_by_first_name, ab.last_name AS allocated_by_last_name
        FROM quota_allocations qa
        LEFT JOIN users u ON u.id = qa.user_id
        LEFT JOIN users ab ON ab.id = qa.allocated_by
        $whereClause
        ORDER BY qa.created_at DESC
        LIMIT 200
    ");
    $stmt->execute($params);
    $allocations = $stmt->fetchAll();

    json_response(['success' => true, 'data' => $allocations]);
}

function handleSummary(PDO $conn) {
    $companyId = intval($_GET['companyId'] ?? 0);
    $quotaProductId = intval($_GET['quotaProductId'] ?? 0);
    if (!$companyId || !$quotaProductId) {
        json_response(['error' => 'companyId and quotaProductId required'], 400);
    }

    // ⚡ PERFORMANCE: Only fetch users who have relevant activity
    // Find the quota product's linked product_id and any scope products
    $qpStmt = $conn->prepare("SELECT product_id FROM quota_products WHERE id = :qpId AND deleted_at IS NULL");
    $qpStmt->execute([':qpId' => $quotaProductId]);
    $qpRow = $qpStmt->fetch();
    $linkedProductId = $qpRow ? intval($qpRow['product_id']) : 0;

    // Get scope product IDs from the latest rate schedule
    // quota_rate_scope stores quota_product_ids, need to resolve to actual product_ids
    $productIds = $linkedProductId ? [$linkedProductId] : [];
    $rateStmt = $conn->prepare("
        SELECT DISTINCT qrs.id FROM quota_rate_schedules qrs
        JOIN quota_rate_scope scope ON scope.rate_schedule_id = qrs.id AND scope.quota_product_id = :qpId
        WHERE qrs.deleted_at IS NULL
        ORDER BY qrs.effective_date DESC LIMIT 1
    ");
    $rateStmt->execute([':qpId' => $quotaProductId]);
    $rateRow = $rateStmt->fetch();
    if ($rateRow) {
        $scopeStmt = $conn->prepare("
            SELECT qp.product_id FROM quota_rate_scope qrs
            JOIN quota_products qp ON qp.id = qrs.quota_product_id AND qp.deleted_at IS NULL
            WHERE qrs.rate_schedule_id = :rid
        ");
        $scopeStmt->execute([':rid' => $rateRow['id']]);
        $scopeRows = $scopeStmt->fetchAll(PDO::FETCH_COLUMN);
        if (!empty($scopeRows)) {
            $productIds = array_merge($productIds, array_map('intval', $scopeRows));
        }
    }
    $productIds = array_unique(array_filter($productIds));

    // Build IN clause for product_ids (safe: all are intval'd)
    $inPlaceholders = !empty($productIds) ? implode(',', $productIds) : '0';

    // Get only users who have:
    // 1. Sales orders with these products, OR
    // 2. Quota allocations, OR
    // 3. Quota usage records
    $userIdsQuery = "
        SELECT DISTINCT u.id, u.first_name, u.last_name, u.role
        FROM users u
        WHERE u.company_id = :companyId AND u.status = 'active'
        AND u.role IN ('Telesale', 'Supervisor Telesale', 'Admin Page')
        AND (
            u.id IN (
                SELECT DISTINCT o.creator_id
                FROM orders o
                JOIN order_items oi ON oi.order_id = o.id
                WHERE o.company_id = :companyId2 AND o.order_status != 'Cancelled'
                AND oi.product_id IN ($inPlaceholders)
            )
            OR u.id IN (
                SELECT DISTINCT qa.user_id
                FROM quota_allocations qa
                WHERE qa.quota_product_id = :qpId1
                AND qa.deleted_at IS NULL
            )
            OR u.id IN (
                SELECT DISTINCT qu.user_id
                FROM quota_usage qu
                WHERE qu.quota_product_id = :qpId2 AND qu.deleted_at IS NULL
            )
        )
        ORDER BY u.first_name ASC
    ";
    $userStmt = $conn->prepare($userIdsQuery);
    $userStmt->execute([
        ':companyId' => $companyId,
        ':companyId2' => $companyId,
        ':qpId1' => $quotaProductId,
        ':qpId2' => $quotaProductId,
    ]);
    $users = $userStmt->fetchAll();

    $summaries = [];
    foreach ($users as $user) {
        $calc = calculateQuota($conn, $quotaProductId, $user['id']);
        $summaries[] = [
            'userId' => $user['id'],
            'userName' => trim($user['first_name'] . ' ' . $user['last_name']),
            'role' => $user['role'],
            'totalSales' => $calc['totalSales'],
            'totalAutoQuota' => $calc['autoQuota'],
            'totalAdminQuota' => $calc['adminQuota'],
            'totalQuota' => $calc['totalQuota'],
            'totalUsed' => $calc['totalUsed'],
            'remaining' => $calc['remaining'],
            'periodStart' => $calc['periodStart'],
            'periodEnd' => $calc['periodEnd'],
            'quotaMode' => $calc['quotaMode'],
            'pendingAutoQuota' => $calc['pendingAutoQuota'] ?? null,
            'isConfirmed' => $calc['isConfirmed'] ?? null,
            'isExpired' => $calc['isExpired'] ?? false,
            'usageEndDate' => $calc['usageEndDate'] ?? null,
            'requireConfirm' => $calc['requireConfirm'] ?? null,
            'isBeforeUsageStart' => $calc['isBeforeUsageStart'] ?? false,
            'rateScheduleId' => $calc['rateScheduleId'] ?? null,
        ];
    }

    json_response(['success' => true, 'data' => $summaries]);
}

// ============================================================
// POST Handlers
// ============================================================

function handleCreateProduct(PDO $conn, array $data) {
    $productId = intval($data['productId'] ?? 0);
    $companyId = intval($data['companyId'] ?? 0);
    $displayName = trim($data['displayName'] ?? '');
    $csvLabel = trim($data['csvLabel'] ?? '') ?: null;
    $quotaCost = intval($data['quotaCost'] ?? 1);

    if (!$productId || !$companyId || !$displayName) {
        json_response(['error' => 'productId, companyId, displayName required'], 400);
    }

    // Fetch source product data
    $srcStmt = $conn->prepare("SELECT * FROM products WHERE id = :id");
    $srcStmt->execute([':id' => $productId]);
    $srcProduct = $srcStmt->fetch(PDO::FETCH_ASSOC);
    if (!$srcProduct) {
        json_response(['error' => 'Source product not found'], 404);
    }

    $conn->beginTransaction();
    try {
        // 1. Duplicate product with QT- prefix SKU
        $newSku = 'QT-' . ($srcProduct['sku'] ?? 'UNKNOWN');
        // Ensure unique SKU — append number if duplicate
        $checkSku = $conn->prepare("SELECT COUNT(*) FROM products WHERE sku = :sku AND company_id = :cid");
        $checkSku->execute([':sku' => $newSku, ':cid' => $companyId]);
        if ($checkSku->fetchColumn() > 0) {
            $counter = 2;
            while (true) {
                $trySku = $newSku . '-' . $counter;
                $checkSku->execute([':sku' => $trySku, ':cid' => $companyId]);
                if ($checkSku->fetchColumn() == 0) {
                    $newSku = $trySku;
                    break;
                }
                $counter++;
            }
        }

        $dupStmt = $conn->prepare("
            INSERT INTO products (sku, name, description, category, unit, cost, price, stock, company_id, shop, status)
            VALUES (:sku, :name, :desc, :category, :unit, :cost, :price, 0, :companyId, :shop, 'Active')
        ");
        $dupStmt->execute([
            ':sku' => $newSku,
            ':name' => $displayName,
            ':desc' => $srcProduct['description'] ?? '',
            ':category' => $srcProduct['category'] ?? '',
            ':unit' => $srcProduct['unit'] ?? 'ชิ้น',
            ':cost' => $srcProduct['cost'] ?? 0,
            ':price' => $srcProduct['price'] ?? 0,
            ':companyId' => $companyId,
            ':shop' => $srcProduct['shop'] ?? '',
        ]);
        $newProductId = $conn->lastInsertId();

        // 2. Create quota_product referencing the duplicate
        $qpStmt = $conn->prepare("
            INSERT INTO quota_products (product_id, company_id, display_name, csv_label, quota_cost)
            VALUES (:productId, :companyId, :displayName, :csvLabel, :quotaCost)
        ");
        $qpStmt->execute([
            ':productId' => $newProductId,
            ':companyId' => $companyId,
            ':displayName' => $displayName,
            ':csvLabel' => $csvLabel,
            ':quotaCost' => $quotaCost,
        ]);
        $quotaProductId = $conn->lastInsertId();

        $conn->commit();
        json_response(['success' => true, 'id' => $quotaProductId, 'productId' => $newProductId]);
    } catch (Exception $e) {
        $conn->rollBack();
        json_response(['error' => 'Failed to create: ' . $e->getMessage()], 500);
    }
}

function handleCreateProductWithQuota(PDO $conn, array $data) {
    $companyId = intval($data['companyId'] ?? 0);
    $displayName = trim($data['displayName'] ?? '');
    $csvLabel = trim($data['csvLabel'] ?? '') ?: null;
    $quotaCost = intval($data['quotaCost'] ?? 1);
    // Product fields
    $sku = trim($data['sku'] ?? '');
    $productName = trim($data['productName'] ?? '') ?: $displayName;
    $price = floatval($data['price'] ?? 0);
    $category = trim($data['category'] ?? '');  
    $shop = trim($data['shop'] ?? '');
    $description = trim($data['description'] ?? '');

    if (!$companyId || !$displayName || !$sku) {
        json_response(['error' => 'companyId, displayName, sku required'], 400);
    }

    $conn->beginTransaction();
    try {
        // 1. Create product in products table
        $stmt = $conn->prepare("
            INSERT INTO products (sku, name, description, category, unit, cost, price, stock, company_id, shop, status)
            VALUES (:sku, :name, :desc, :category, 'ชิ้น', 0, :price, 0, :companyId, :shop, 'Active')
        ");
        $stmt->execute([
            ':sku' => $sku,
            ':name' => $productName,
            ':desc' => $description,
            ':category' => $category,
            ':price' => $price,
            ':companyId' => $companyId,
            ':shop' => $shop,
        ]);
        $newProductId = $conn->lastInsertId();

        // 2. Create quota_product linked to the new product
        $stmt2 = $conn->prepare("
            INSERT INTO quota_products (product_id, company_id, display_name, csv_label, quota_cost)
            VALUES (:productId, :companyId, :displayName, :csvLabel, :quotaCost)
        ");
        $stmt2->execute([
            ':productId' => $newProductId,
            ':companyId' => $companyId,
            ':displayName' => $displayName,
            ':csvLabel' => $csvLabel,
            ':quotaCost' => $quotaCost,
        ]);
        $quotaProductId = $conn->lastInsertId();

        $conn->commit();
        json_response(['success' => true, 'id' => $quotaProductId, 'productId' => $newProductId]);
    } catch (Exception $e) {
        $conn->rollBack();
        json_response(['error' => 'Failed to create: ' . $e->getMessage()], 500);
    }
}

function handleUpdateProduct(PDO $conn, array $data) {
    $id = intval($data['id'] ?? 0);
    if (!$id) {
        json_response(['error' => 'id required'], 400);
    }

    $fields = [];
    $params = [':id' => $id];

    if (isset($data['displayName'])) {
        $fields[] = 'display_name = :displayName';
        $params[':displayName'] = trim($data['displayName']);
    }
    if (array_key_exists('csvLabel', $data)) {
        $fields[] = 'csv_label = :csvLabel';
        $params[':csvLabel'] = trim($data['csvLabel']) ?: null;
    }
    if (isset($data['isActive'])) {
        $fields[] = 'is_active = :isActive';
        $params[':isActive'] = $data['isActive'] ? 1 : 0;
    }
    if (isset($data['quotaCost'])) {
        $fields[] = 'quota_cost = :quotaCost';
        $params[':quotaCost'] = intval($data['quotaCost']);
    }

    if (empty($fields)) {
        json_response(['error' => 'No fields to update'], 400);
    }

    $stmt = $conn->prepare("UPDATE quota_products SET " . implode(', ', $fields) . " WHERE id = :id");
    $stmt->execute($params);

    json_response(['success' => true]);
}

function handleCreateRate(PDO $conn, array $data) {
    $rateName = trim($data['rateName'] ?? '') ?: null;
    $salesPerQuota = floatval($data['salesPerQuota'] ?? 0);
    $effectiveDate = $data['effectiveDate'] ?? '';
    $orderDateField = $data['orderDateField'] ?? 'order_date';
    // Force confirm mode — no mode selection needed
    $quotaMode = 'confirm';
    $createdBy = intval($data['createdBy'] ?? 0) ?: null;

    // scopeRates: [{ quotaProductId: number, salesPerQuota: number }]
    $scopeRates = $data['scopeRates'] ?? [];
    // Backward compat: also accept scopeProductIds (uses global salesPerQuota)
    $scopeProductIds = $data['scopeProductIds'] ?? [];

    if (!$effectiveDate) {
        json_response(['error' => 'effectiveDate required'], 400);
    }
    if (!in_array($orderDateField, ['order_date', 'delivery_date'])) {
        $orderDateField = 'order_date';
    }

    // Must have scope products (no global rates)
    if (empty($scopeRates) && empty($scopeProductIds)) {
        json_response(['error' => 'scopeRates or scopeProductIds required (no global rates)'], 400);
    }

    // Confirm mode fields
    $calcPeriodStart = !empty($data['calcPeriodStart']) ? $data['calcPeriodStart'] : null;
    $calcPeriodEnd = !empty($data['calcPeriodEnd']) ? $data['calcPeriodEnd'] : null;
    $usageStartDate = !empty($data['usageStartDate']) ? $data['usageStartDate'] : null;
    $usageEndDate = !empty($data['usageEndDate']) ? $data['usageEndDate'] : null;
    $requireConfirm = isset($data['requireConfirm']) ? (intval($data['requireConfirm']) ? 1 : 0) : 1;

    // If scopeRates is used, use the first product's rate as the header-level salesPerQuota fallback
    if (!empty($scopeRates) && $salesPerQuota <= 0) {
        $salesPerQuota = floatval($scopeRates[0]['salesPerQuota'] ?? 0);
    }
    if ($salesPerQuota <= 0) {
        json_response(['error' => 'salesPerQuota (>0) required'], 400);
    }

    $stmt = $conn->prepare("
        INSERT INTO quota_rate_schedules 
            (rate_name, quota_product_id, sales_per_quota, effective_date, order_date_field, quota_mode,
             reset_interval_days, reset_day_of_month, reset_anchor_date,
             calc_period_start, calc_period_end, usage_start_date, usage_end_date, require_confirm, created_by)
        VALUES 
            (:rn, NULL, :sPerQ, :effDate, :odf, :qm,
             30, NULL, NULL,
             :cps, :cpe, :usd, :ued, :rc, :cb)
    ");
    $stmt->execute([
        ':rn' => $rateName,
        ':sPerQ' => $salesPerQuota,
        ':effDate' => $effectiveDate,
        ':odf' => $orderDateField,
        ':qm' => $quotaMode,
        ':cb' => $createdBy,
        ':cps' => $calcPeriodStart,
        ':cpe' => $calcPeriodEnd,
        ':usd' => $usageStartDate,
        ':ued' => $usageEndDate,
        ':rc' => $requireConfirm,
    ]);

    $newRateId = $conn->lastInsertId();

    // Insert scope rows with per-product sales_per_quota
    if (!empty($scopeRates) && is_array($scopeRates)) {
        $scopeStmt = $conn->prepare("INSERT INTO quota_rate_scope (rate_schedule_id, quota_product_id, sales_per_quota) VALUES (:rid, :qpid, :spq)");
        foreach ($scopeRates as $sr) {
            $spId = intval($sr['quotaProductId'] ?? 0);
            $spRate = floatval($sr['salesPerQuota'] ?? 0);
            if ($spId > 0 && $spRate > 0) {
                $scopeStmt->execute([':rid' => $newRateId, ':qpid' => $spId, ':spq' => $spRate]);
            }
        }
    } elseif (!empty($scopeProductIds) && is_array($scopeProductIds)) {
        // Backward compat: insert with NULL sales_per_quota (use header rate)
        $scopeStmt = $conn->prepare("INSERT INTO quota_rate_scope (rate_schedule_id, quota_product_id) VALUES (:rid, :qpid)");
        foreach ($scopeProductIds as $spId) {
            $spId = intval($spId);
            if ($spId > 0) {
                $scopeStmt->execute([':rid' => $newRateId, ':qpid' => $spId]);
            }
        }
    }

    json_response(['success' => true, 'id' => $newRateId]);
}

function handleUpdateRate(PDO $conn, array $data) {
    $id = intval($data['id'] ?? 0);
    if (!$id) {
        json_response(['error' => 'id required'], 400);
    }

    $fields = [];
    $params = [':id' => $id];

    if (array_key_exists('rateName', $data)) {
        $fields[] = 'rate_name = :rn';
        $params[':rn'] = trim($data['rateName']) ?: null;
    }
    if (isset($data['salesPerQuota'])) {
        $fields[] = 'sales_per_quota = :spq';
        $params[':spq'] = floatval($data['salesPerQuota']);
    }
    if (isset($data['effectiveDate'])) {
        $fields[] = 'effective_date = :ed';
        $params[':ed'] = $data['effectiveDate'];
    }
    if (isset($data['orderDateField'])) {
        $odf = in_array($data['orderDateField'], ['order_date', 'delivery_date']) ? $data['orderDateField'] : 'order_date';
        $fields[] = 'order_date_field = :odf';
        $params[':odf'] = $odf;
    }
    // Force confirm mode — ignore any quotaMode changes
    // if (isset($data['quotaMode'])) { ... }
    if (array_key_exists('calcPeriodStart', $data)) {
        $fields[] = 'calc_period_start = :cps';
        $params[':cps'] = $data['calcPeriodStart'];
    }
    if (array_key_exists('calcPeriodEnd', $data)) {
        $fields[] = 'calc_period_end = :cpe';
        $params[':cpe'] = $data['calcPeriodEnd'];
    }
    if (array_key_exists('usageStartDate', $data)) {
        $fields[] = 'usage_start_date = :usd';
        $params[':usd'] = $data['usageStartDate'];
    }
    if (array_key_exists('usageEndDate', $data)) {
        $fields[] = 'usage_end_date = :ued';
        $params[':ued'] = $data['usageEndDate'];
    }
    if (array_key_exists('requireConfirm', $data)) {
        $fields[] = 'require_confirm = :rc';
        $params[':rc'] = intval($data['requireConfirm']) ? 1 : 0;
    }

    if (!empty($fields)) {
        $sql = "UPDATE quota_rate_schedules SET " . implode(', ', $fields) . " WHERE id = :id";
        $conn->prepare($sql)->execute($params);
    }

    // Update scope rates if provided
    $scopeRates = $data['scopeRates'] ?? null;
    if ($scopeRates !== null && is_array($scopeRates)) {
        // Delete existing scope
        $conn->prepare("DELETE FROM quota_rate_scope WHERE rate_schedule_id = :rid")->execute([':rid' => $id]);
        // Insert new scope
        $scopeStmt = $conn->prepare("INSERT INTO quota_rate_scope (rate_schedule_id, quota_product_id, sales_per_quota) VALUES (:rid, :qpid, :spq)");
        foreach ($scopeRates as $sr) {
            $spId = intval($sr['quotaProductId'] ?? 0);
            $spRate = floatval($sr['salesPerQuota'] ?? 0);
            if ($spId > 0 && $spRate > 0) {
                $scopeStmt->execute([':rid' => $id, ':qpid' => $spId, ':spq' => $spRate]);
            }
        }
    }

    json_response(['success' => true]);
}

function handleDeleteRate(PDO $conn, array $data) {
    $id = intval($data['id'] ?? 0);
    if (!$id) {
        json_response(['error' => 'id required'], 400);
    }

    $conn->prepare("UPDATE quota_rate_schedules SET deleted_at = NOW() WHERE id = :id AND deleted_at IS NULL")->execute([':id' => $id]);
    json_response(['success' => true]);
}

function handleConfirmQuota(PDO $conn, array $data) {
    $quotaProductId = intval($data['quotaProductId'] ?? 0);
    $userId = intval($data['userId'] ?? 0);
    $rateScheduleId = intval($data['rateScheduleId'] ?? 0);
    $confirmedBy = intval($data['confirmedBy'] ?? 0) ?: null;

    if (!$quotaProductId || !$userId || !$rateScheduleId) {
        json_response(['error' => 'quotaProductId, userId, rateScheduleId required'], 400);
    }

    // Get rate schedule
    $stmtRate = $conn->prepare("SELECT * FROM quota_rate_schedules WHERE id = :id AND deleted_at IS NULL");
    $stmtRate->execute([':id' => $rateScheduleId]);
    $rate = $stmtRate->fetch(PDO::FETCH_ASSOC);
    if (!$rate || $rate['quota_mode'] !== 'confirm') {
        json_response(['error' => 'Rate schedule not found or not in confirm mode'], 400);
    }

    $dateCol = ($rate['order_date_field'] === 'delivery_date') ? 'o.delivery_date' : 'o.order_date';
    $calcStart = $rate['calc_period_start'];
    $calcEnd = $rate['calc_period_end'];

    // Per-product rate: check scope first, fallback to header
    $scopeStmt = $conn->prepare("SELECT sales_per_quota FROM quota_rate_scope WHERE rate_schedule_id = :rid AND quota_product_id = :qpid");
    $scopeStmt->execute([':rid' => $rateScheduleId, ':qpid' => $quotaProductId]);
    $scopeRow = $scopeStmt->fetch();
    $salesPerQuota = ($scopeRow && floatval($scopeRow['sales_per_quota']) > 0)
        ? floatval($scopeRow['sales_per_quota'])
        : floatval($rate['sales_per_quota']);

    if (!$calcStart || !$calcEnd || $salesPerQuota <= 0) {
        json_response(['error' => 'Rate schedule missing calc_period or salesPerQuota'], 400);
    }

    $totalSales = _calcSalesInPeriod($conn, $userId, $quotaProductId, $dateCol, $calcStart, $calcEnd);
    $autoQuota = floor($totalSales / $salesPerQuota);

    // Get company_id from quota_product
    $stmtQP = $conn->prepare("SELECT company_id FROM quota_products WHERE id = :id AND deleted_at IS NULL");
    $stmtQP->execute([':id' => $quotaProductId]);
    $qp = $stmtQP->fetch();
    $companyId = $qp['company_id'] ?? 0;

    // Delete existing auto_confirmed for this rate+user (re-confirm overwrites)
    $conn->prepare("
        UPDATE quota_allocations SET deleted_at = NOW()
        WHERE quota_product_id = :qpId AND user_id = :uid AND source = 'auto_confirmed' AND source_detail = :rsId AND deleted_at IS NULL
    ")->execute([':qpId' => $quotaProductId, ':uid' => $userId, ':rsId' => (string)$rateScheduleId]);

    // Insert confirmed allocation
    $conn->prepare("
        INSERT INTO quota_allocations (quota_product_id, user_id, company_id, quantity, source, source_detail, allocated_by, period_start, period_end)
        VALUES (:qpId, :uid, :cid, :qty, 'auto_confirmed', :rsId, :ab, :ps, :pe)
    ")->execute([
        ':qpId' => $quotaProductId,
        ':uid' => $userId,
        ':cid' => $companyId,
        ':qty' => $autoQuota,
        ':rsId' => (string)$rateScheduleId,
        ':ab' => $confirmedBy,
        ':ps' => $calcStart,
        ':pe' => $calcEnd,
    ]);

    json_response([
        'success' => true,
        'confirmedQuota' => $autoQuota,
        'totalSales' => $totalSales,
    ]);
}

function handleAllocate(PDO $conn, array $data) {
    $quotaProductId = intval($data['quotaProductId'] ?? 0);
    $userId = intval($data['userId'] ?? 0);
    $companyId = intval($data['companyId'] ?? 0);
    $quantity = floatval($data['quantity'] ?? 0);
    $source = $data['source'] ?? 'admin';
    $sourceDetail = $data['sourceDetail'] ?? null;
    $allocatedBy = intval($data['allocatedBy'] ?? 0) ?: null;
    $periodStart = $data['periodStart'] ?? null;
    $periodEnd = $data['periodEnd'] ?? null;
    $validFrom = $data['validFrom'] ?? null;
    $validUntil = $data['validUntil'] ?? null;

    if (!$userId || !$companyId || $quantity <= 0) {
        json_response(['error' => 'userId, companyId, quantity (>0) required'], 400);
    }

    $stmt = $conn->prepare("
        INSERT INTO quota_allocations 
            (quota_product_id, user_id, company_id, quantity, source, source_detail, allocated_by, period_start, period_end, valid_from, valid_until)
        VALUES 
            (:qpId, :userId, :companyId, :qty, :source, :detail, :allocBy, :ps, :pe, :vf, :vu)
    ");
    $stmt->execute([
        ':qpId' => $quotaProductId ?: null,
        ':userId' => $userId,
        ':companyId' => $companyId,
        ':qty' => $quantity,
        ':source' => $source,
        ':detail' => $sourceDetail,
        ':allocBy' => $allocatedBy,
        ':ps' => $periodStart,
        ':pe' => $periodEnd,
        ':vf' => $validFrom ?: null,
        ':vu' => $validUntil ?: null,
    ]);

    json_response(['success' => true, 'id' => $conn->lastInsertId()]);
}

function handleUseQuota(PDO $conn, array $data) {
    $quotaProductId = intval($data['quotaProductId'] ?? 0);
    $userId = intval($data['userId'] ?? 0);
    $companyId = intval($data['companyId'] ?? 0);
    $orderId = $data['orderId'] ?? '';
    $quantityUsed = floatval($data['quantityUsed'] ?? 0);
    $periodStart = $data['periodStart'] ?? null;
    $periodEnd = $data['periodEnd'] ?? null;

    if (!$quotaProductId || !$userId || !$companyId || !$orderId || $quantityUsed <= 0) {
        json_response(['error' => 'quotaProductId, userId, companyId, orderId, quantityUsed (>0) required'], 400);
    }

    $stmt = $conn->prepare("
        INSERT INTO quota_usage 
            (quota_product_id, user_id, company_id, order_id, quantity_used, period_start, period_end)
        VALUES 
            (:qpId, :userId, :companyId, :orderId, :qty, :ps, :pe)
    ");
    $stmt->execute([
        ':qpId' => $quotaProductId,
        ':userId' => $userId,
        ':companyId' => $companyId,
        ':orderId' => $orderId,
        ':qty' => $quantityUsed,
        ':ps' => $periodStart,
        ':pe' => $periodEnd,
    ]);

    json_response(['success' => true, 'id' => $conn->lastInsertId()]);
}

// ============================================================
// Core Calculation
// ============================================================

function calculateQuota(PDO $conn, int $quotaProductId, int $userId): array {
    // 1. Find the latest rate that includes this product in its scope
    $stmtRate = $conn->prepare("
        SELECT qrs.*, scope.sales_per_quota AS scope_sales_per_quota
        FROM quota_rate_schedules qrs
        JOIN quota_rate_scope scope ON scope.rate_schedule_id = qrs.id AND scope.quota_product_id = :qpId
        WHERE qrs.deleted_at IS NULL
        ORDER BY
            CASE WHEN qrs.quota_mode = 'confirm' THEN qrs.usage_start_date ELSE qrs.effective_date END DESC
        LIMIT 1
    ");
    $stmtRate->execute([':qpId' => $quotaProductId]);
    $latestRate = $stmtRate->fetch();

    if (!$latestRate) {
        // No rate schedule — but still calculate admin allocations & usage below
        $salesPerQuota = 0;
        $quotaMode = 'N/A';
        $dateCol = 'o.order_date';
    } else {

    // Use per-product rate from scope if available, else fallback to rate header
    $salesPerQuota = floatval($latestRate['scope_sales_per_quota'] ?? 0);
    if ($salesPerQuota <= 0) {
        $salesPerQuota = floatval($latestRate['sales_per_quota']);
    }

    $quotaMode = $latestRate['quota_mode'];
    $dateCol = ($latestRate['order_date_field'] === 'delivery_date') ? 'o.delivery_date' : 'o.order_date';
    $periodStart = null;
    $periodEnd = null;
    $totalSales = 0;
    $autoQuota = 0;
    $pendingAutoQuota = null;
    $isConfirmed = null;
    $isExpired = false;
    $isBeforeUsageStart = false;

    if ($quotaMode === 'confirm') {
        // ====== CONFIRM MODE ======
        $calcStart = $latestRate['calc_period_start'];
        $calcEnd = $latestRate['calc_period_end'];
        $usageStartDate = $latestRate['usage_start_date'] ?? $latestRate['effective_date'];

        $periodStart = $calcStart;
        $periodEnd = $calcEnd;

        if ($calcStart && $calcEnd) {
            $totalSales = _calcSalesInPeriod($conn, $userId, $quotaProductId, $dateCol, $calcStart, $calcEnd);
            $pendingAutoQuota = ($salesPerQuota > 0) ? floor($totalSales / $salesPerQuota) : 0;
        } else {
            $pendingAutoQuota = 0;
        }

        $requireConfirm = intval($latestRate['require_confirm'] ?? 1);
        if ($requireConfirm) {
            $stmtConf = $conn->prepare("
                SELECT COALESCE(SUM(quantity), 0) AS confirmed_total
                FROM quota_allocations
                WHERE quota_product_id = :qpId AND user_id = :uid AND source = 'auto_confirmed'
                AND source_detail = :rsId AND deleted_at IS NULL
            ");
            $stmtConf->execute([':qpId' => $quotaProductId, ':uid' => $userId, ':rsId' => (string)$latestRate['id']]);
            $confirmedQuota = floatval($stmtConf->fetch()['confirmed_total']);
            $isConfirmed = $confirmedQuota > 0;
            $autoQuota = $confirmedQuota;
        } else {
            $autoQuota = $pendingAutoQuota;
        }

        // Check expiry
        $usageEndDate = $latestRate['usage_end_date'] ?? null;
        if ($usageEndDate && strlen($usageEndDate) >= 10 && date('Y-m-d') > $usageEndDate) {
            $isExpired = true;
        }
        if ($usageStartDate && date('Y-m-d') < $usageStartDate) {
            $autoQuota = 0;
            $isBeforeUsageStart = true;
        }

    } elseif ($quotaMode === 'reset') {
        // ====== RESET MODE (backward compat) ======
        $resetDayOfMonth = $latestRate['reset_day_of_month'] ? intval($latestRate['reset_day_of_month']) : null;
        if ($resetDayOfMonth) {
            $now = new DateTime();
            $cd = intval($now->format('j'));
            $cy = intval($now->format('Y'));
            $cm = intval($now->format('n'));
            if ($cd >= $resetDayOfMonth) {
                $ps = new DateTime("$cy-$cm-$resetDayOfMonth");
                $periodStart = $ps->format('Y-m-d');
                $periodEnd = (clone $ps)->modify('+1 month')->format('Y-m-d');
            } else {
                $pe = new DateTime("$cy-$cm-$resetDayOfMonth");
                $periodStart = (clone $pe)->modify('-1 month')->format('Y-m-d');
                $periodEnd = $pe->format('Y-m-d');
            }
        } else {
            $intervalDays = intval($latestRate['reset_interval_days']);
            $anchor = new DateTime($latestRate['reset_anchor_date'] ?: $latestRate['effective_date']);
            $now = new DateTime();
            if ($now < $anchor) {
                $periodStart = $anchor->format('Y-m-d');
                $periodEnd = (clone $anchor)->modify("+{$intervalDays} days")->format('Y-m-d');
            } else {
                $elapsed = floor(intval($anchor->diff($now)->days) / $intervalDays);
                $ps = (clone $anchor)->modify("+".($elapsed * $intervalDays)." days");
                $periodStart = $ps->format('Y-m-d');
                $periodEnd = (clone $ps)->modify("+{$intervalDays} days")->format('Y-m-d');
            }
        }
        $totalSales = _calcSalesInPeriod($conn, $userId, $quotaProductId, $dateCol, $periodStart, $periodEnd);
        $autoQuota = ($salesPerQuota > 0) ? floor($totalSales / $salesPerQuota) : 0;

    } elseif ($quotaMode === 'cumulative') {
        // ====== CUMULATIVE MODE (backward compat) ======
        $periodStart = $latestRate['effective_date'];
        $periodEnd = date('Y-m-d');
        $totalSales = _calcSalesInPeriod($conn, $userId, $quotaProductId, $dateCol, $periodStart, $periodEnd);
        $autoQuota = ($salesPerQuota > 0) ? floor($totalSales / $salesPerQuota) : 0;
    }
    } // end else (latestRate exists)

    // Admin-added quota
    $adminQuery = "
        SELECT COALESCE(SUM(quantity), 0) AS admin_total FROM quota_allocations
        WHERE quota_product_id = :qpId AND user_id = :userId AND source = 'admin' AND deleted_at IS NULL
        AND (valid_from IS NULL OR valid_from <= CURDATE())
        AND (valid_until IS NULL OR valid_until >= CURDATE())
    ";
    $adminParams = [':qpId' => $quotaProductId, ':userId' => $userId];
    if ($quotaMode === 'reset') {
        $adminQuery .= " AND period_start = :ps AND period_end = :pe";
        $adminParams[':ps'] = $periodStart;
        $adminParams[':pe'] = $periodEnd;
    }
    $adminQuota = floatval($conn->prepare($adminQuery)->execute($adminParams) ? $conn->prepare($adminQuery) : 0);
    // Re-run properly
    $stmtAdmin = $conn->prepare($adminQuery);
    $stmtAdmin->execute($adminParams);
    $adminQuota = floatval($stmtAdmin->fetch()['admin_total']);

    // Usage
    $usageQuery = "
        SELECT COALESCE(SUM(quantity_used), 0) AS total_used FROM quota_usage
        WHERE quota_product_id = :qpId AND user_id = :userId AND deleted_at IS NULL
    ";
    $usageParams = [':qpId' => $quotaProductId, ':userId' => $userId];
    if ($quotaMode === 'reset') {
        $usageQuery .= " AND period_start = :ps AND period_end = :pe";
        $usageParams[':ps'] = $periodStart;
        $usageParams[':pe'] = $periodEnd;
    }
    $stmtUsage = $conn->prepare($usageQuery);
    $stmtUsage->execute($usageParams);
    $totalUsed = floatval($stmtUsage->fetch()['total_used']);

    $totalQuota = $autoQuota + $adminQuota;
    $remaining = $totalQuota - $totalUsed;

    return [
        'autoQuota' => $autoQuota,
        'adminQuota' => $adminQuota,
        'totalQuota' => $totalQuota,
        'totalUsed' => $totalUsed,
        'remaining' => $remaining,
        'totalSales' => $totalSales,
        'salesPerQuota' => $salesPerQuota,
        'quotaMode' => $quotaMode,
        'periodStart' => $periodStart,
        'periodEnd' => $periodEnd,
        'pendingAutoQuota' => $pendingAutoQuota,
        'isConfirmed' => $isConfirmed,
        'isExpired' => $isExpired ?? false,
        'usageEndDate' => $latestRate['usage_end_date'] ?? null,
        'requireConfirm' => isset($latestRate['require_confirm']) ? intval($latestRate['require_confirm']) : null,
        'isBeforeUsageStart' => $isBeforeUsageStart,
        'rateScheduleId' => $latestRate['id'] ?? null,
    ];
}

/**
 * Helper: Calculate total sales for a user within a date range.
 * Uses oi.creator_id (not o.creator_id) to include upsell items.
 * Uses oi.parent_order_id (not oi.order_id) for JOIN because order_items.order_id has -1 suffix.
 */
function _calcSalesInPeriod(PDO $conn, int $userId, int $quotaProductId, string $dateCol, string $periodStart, string $periodEnd): float {
    $stmt = $conn->prepare("
        SELECT COALESCE(SUM(oi.quantity * oi.price_per_unit), 0) AS total_sales
        FROM order_items oi
        JOIN orders o ON o.id = oi.parent_order_id
        WHERE oi.creator_id = :userId
        AND o.company_id = (SELECT company_id FROM quota_products WHERE id = :qpId AND deleted_at IS NULL)
        AND o.order_status != 'Cancelled'
        AND $dateCol >= :periodStart
        AND $dateCol < :periodEnd
    ");
    $stmt->execute([
        ':userId' => $userId,
        ':qpId' => $quotaProductId,
        ':periodStart' => $periodStart,
        ':periodEnd' => $periodEnd,
    ]);
    $row = $stmt->fetch();
    return floatval($row['total_sales']);
}

// _calcSalesInPeriodByCompany removed — no longer needed
// _calcSalesInPeriodByCompany removed — no global rates

// ============================================================
// Summary By Rate — new endpoint
// ============================================================

function handleSummaryByRate(PDO $conn) {
    $companyId = intval($_GET['companyId'] ?? 0);
    $rateParam = $_GET['rateScheduleId'] ?? '';
    if (!$companyId) {
        json_response(['error' => 'companyId required'], 400);
    }

    // Get all active users
    $stmtUsers = $conn->prepare("
        SELECT id, first_name, last_name, role
        FROM users
        WHERE company_id = :companyId AND status = 'active'
        AND role IN ('Telesale', 'Supervisor Telesale', 'Admin Page')
        ORDER BY first_name ASC
    ");
    $stmtUsers->execute([':companyId' => $companyId]);
    $users = $stmtUsers->fetchAll();

    if ($rateParam === 'all') {
        // ====== AGGREGATE MODE: sum across all active rates ======
        // Filter via scope JOINs — only rates that have scope products in this company
        $stmtRates = $conn->prepare("
            SELECT DISTINCT qrs.* FROM quota_rate_schedules qrs
            JOIN quota_rate_scope scope ON scope.rate_schedule_id = qrs.id
            JOIN quota_products qp ON qp.id = scope.quota_product_id AND qp.company_id = :companyId AND qp.deleted_at IS NULL
            WHERE qrs.deleted_at IS NULL
            ORDER BY qrs.effective_date DESC
        ");
        $stmtRates->execute([':companyId' => $companyId]);
        $ratesForCompany = $stmtRates->fetchAll();

        // Dedupe by rate id
        $uniqueRates = [];
        $seen = [];
        foreach ($ratesForCompany as $rate) {
            $key = $rate['id'];
            if (!isset($seen[$key])) {
                $uniqueRates[] = $rate;
                $seen[$key] = true;
            }
        }

        $summaries = [];
        foreach ($users as $user) {
            $totalAutoQuota = 0;
            $totalAdminQuota = 0;
            $totalSales = 0;
            $totalUsed = 0;

            foreach ($uniqueRates as $rate) {
                $calc = calculateQuotaByRate($conn, $rate, $user['id'], $companyId);
                $totalAutoQuota += $calc['autoQuota'];
                $totalAdminQuota += $calc['adminQuota'];
                $totalSales += $calc['totalSales'];
                $totalUsed += $calc['totalUsed'];
            }

            $totalQuota = $totalAutoQuota + $totalAdminQuota;
            $summaries[] = [
                'userId' => $user['id'],
                'userName' => trim($user['first_name'] . ' ' . $user['last_name']),
                'role' => $user['role'],
                'totalSales' => $totalSales,
                'totalAutoQuota' => $totalAutoQuota,
                'totalAdminQuota' => $totalAdminQuota,
                'totalQuota' => $totalQuota,
                'totalUsed' => $totalUsed,
                'remaining' => $totalQuota - $totalUsed,
                'periodStart' => null,
                'periodEnd' => null,
                'quotaMode' => 'all',
            ];
        }

        json_response(['success' => true, 'data' => $summaries]);
        return;
    }

    // ====== SINGLE RATE MODE ======
    $rateScheduleId = intval($rateParam);
    if (!$rateScheduleId) {
        json_response(['error' => 'rateScheduleId required (number or "all")'], 400);
    }

    $stmtRate = $conn->prepare("SELECT * FROM quota_rate_schedules WHERE id = :id AND deleted_at IS NULL");
    $stmtRate->execute([':id' => $rateScheduleId]);
    $rate = $stmtRate->fetch(PDO::FETCH_ASSOC);
    if (!$rate) {
        json_response(['error' => 'Rate schedule not found'], 404);
    }

    $summaries = [];
    foreach ($users as $user) {
        $calc = calculateQuotaByRate($conn, $rate, $user['id'], $companyId);
        $summaries[] = [
            'userId' => $user['id'],
            'userName' => trim($user['first_name'] . ' ' . $user['last_name']),
            'role' => $user['role'],
            'totalSales' => $calc['totalSales'],
            'totalAutoQuota' => $calc['autoQuota'],
            'totalAdminQuota' => $calc['adminQuota'],
            'totalQuota' => $calc['totalQuota'],
            'totalUsed' => $calc['totalUsed'],
            'remaining' => $calc['remaining'],
            'periodStart' => $calc['periodStart'],
            'periodEnd' => $calc['periodEnd'],
            'quotaMode' => $calc['quotaMode'],
            'pendingAutoQuota' => $calc['pendingAutoQuota'] ?? null,
            'isConfirmed' => $calc['isConfirmed'] ?? null,
            'isExpired' => $calc['isExpired'] ?? false,
            'usageEndDate' => $calc['usageEndDate'] ?? null,
            'requireConfirm' => $calc['requireConfirm'] ?? null,
            'isBeforeUsageStart' => $calc['isBeforeUsageStart'] ?? false,
            'rateScheduleId' => intval($rate['id']),
        ];
    }

    json_response(['success' => true, 'data' => $summaries]);
}

/**
 * Per-user quota detail: returns per-rate breakdown for a single user.
 */
function handleUserQuotaDetail(PDO $conn) {
    $companyId = intval($_GET['companyId'] ?? 0);
    $userId = intval($_GET['userId'] ?? 0);
    $rateParam = $_GET['rateScheduleId'] ?? 'all';
    if (!$companyId || !$userId) {
        json_response(['error' => 'companyId and userId required'], 400);
    }

    // Get all rates applicable to this company via scope JOINs
    $stmtRates = $conn->prepare("
        SELECT DISTINCT qrs.* FROM quota_rate_schedules qrs
        JOIN quota_rate_scope scope ON scope.rate_schedule_id = qrs.id
        JOIN quota_products qp ON qp.id = scope.quota_product_id AND qp.company_id = :companyId AND qp.deleted_at IS NULL
        WHERE qrs.deleted_at IS NULL
        ORDER BY qrs.effective_date DESC
    ");
    $stmtRates->execute([':companyId' => $companyId]);
    $ratesForCompany = $stmtRates->fetchAll();

    // If specific rateScheduleId requested, filter
    if ($rateParam !== 'all') {
        $rateId = intval($rateParam);
        $ratesForCompany = array_filter($ratesForCompany, function($r) use ($rateId) {
            return intval($r['id']) === $rateId;
        });
    }

    // Dedupe
    $uniqueRates = [];
    $seen = [];
    foreach ($ratesForCompany as $rate) {
        $key = $rate['id'];
        if (!isset($seen[$key])) {
            $uniqueRates[] = $rate;
            $seen[$key] = true;
        }
    }

    // Resolve product names
    $productNameCache = [];
    $stmtQP = $conn->prepare("SELECT qp.id, qp.display_name, p.name AS product_name, p.sku
        FROM quota_products qp LEFT JOIN products p ON qp.product_id = p.id
        WHERE qp.company_id = :cid AND qp.deleted_at IS NULL");
    $stmtQP->execute([':cid' => $companyId]);
    foreach ($stmtQP->fetchAll() as $qp) {
        $productNameCache[intval($qp['id'])] = $qp['display_name'] ?: $qp['product_name'] ?: ('SKU: ' . $qp['sku']);
    }

    // Resolve scope product ids + rates for each rate
    $scopeCache = [];
    $stmtScope = $conn->prepare("SELECT rate_schedule_id, quota_product_id, sales_per_quota FROM quota_rate_scope");
    $stmtScope->execute();
    foreach ($stmtScope->fetchAll() as $row) {
        $rsId = intval($row['rate_schedule_id']);
        if (!isset($scopeCache[$rsId])) $scopeCache[$rsId] = [];
        $scopeCache[$rsId][] = intval($row['quota_product_id']);
    }

    $details = [];
    foreach ($uniqueRates as $rate) {
        $calc = calculateQuotaByRate($conn, $rate, $userId, $companyId);

        $rateId = intval($rate['id']);
        $scopeIds = $scopeCache[$rateId] ?? [];

        // Determine product label from scope
        if (!empty($scopeIds)) {
            $names = array_map(function($id) use ($productNameCache) {
                return $productNameCache[$id] ?? "#$id";
            }, $scopeIds);
            $productLabel = implode(', ', $names);
        } else {
            $productLabel = 'ไม่ระบุสินค้า';
        }

        $modeLabel = $rate['quota_mode'] === 'reset' ? 'รีเซ็ต' : ($rate['quota_mode'] === 'cumulative' ? 'สะสม' : 'กำหนดเอง');

        $details[] = [
            'rateScheduleId' => $rateId,
            'rateName' => $rate['rate_name'] ?: null,
            'productLabel' => $productLabel,
            'quotaMode' => $rate['quota_mode'],
            'modeLabel' => $modeLabel,
            'salesPerQuota' => floatval($rate['sales_per_quota']),
            'totalSales' => $calc['totalSales'],
            'autoQuota' => $calc['autoQuota'],
            'adminQuota' => $calc['adminQuota'],
            'totalQuota' => $calc['totalQuota'],
            'totalUsed' => $calc['totalUsed'],
            'remaining' => $calc['remaining'],
            'periodStart' => $calc['periodStart'],
            'periodEnd' => $calc['periodEnd'],
            'pendingAutoQuota' => $calc['pendingAutoQuota'],
            'isConfirmed' => $calc['isConfirmed'],
            'isExpired' => $calc['isExpired'],
        ];
    }

    json_response(['success' => true, 'data' => $details]);
}

/**
 * Calculate quota for a specific user using a SPECIFIC rate schedule directly.
 * Unlike calculateQuota(), this doesn't search for rates — it uses the one provided.
 */
function calculateQuotaByRate(PDO $conn, array $rate, int $userId, int $companyId): array {
    $quotaMode = $rate['quota_mode'];
    $dateCol = (($rate['order_date_field'] ?? 'order_date') === 'delivery_date') ? 'o.delivery_date' : 'o.order_date';
    $headerSalesPerQuota = floatval($rate['sales_per_quota']);
    $periodStart = null;
    $periodEnd = null;
    $totalSales = 0;
    $autoQuota = 0;
    $pendingAutoQuota = null;
    $isConfirmed = null;
    $isExpired = false;
    $isBeforeUsageStart = false;

    // Get scope products with per-product rates
    $scopeStmt = $conn->prepare("
        SELECT scope.quota_product_id, scope.sales_per_quota, qp.company_id
        FROM quota_rate_scope scope
        JOIN quota_products qp ON qp.id = scope.quota_product_id AND qp.deleted_at IS NULL
        WHERE scope.rate_schedule_id = :rid
    ");
    $scopeStmt->execute([':rid' => $rate['id']]);
    $scopeProducts = $scopeStmt->fetchAll(PDO::FETCH_ASSOC);

    // Filter to products in this company
    $scopeProducts = array_filter($scopeProducts, function($sp) use ($companyId) { return intval($sp['company_id']) === $companyId; });
    $scopeProductIds = array_column($scopeProducts, 'quota_product_id');

    if (empty($scopeProductIds)) {
        return [
            'autoQuota' => 0, 'adminQuota' => 0, 'totalQuota' => 0,
            'totalUsed' => 0, 'remaining' => 0, 'totalSales' => 0,
            'salesPerQuota' => $headerSalesPerQuota, 'quotaMode' => $quotaMode,
            'periodStart' => null, 'periodEnd' => null,
            'pendingAutoQuota' => 0, 'isConfirmed' => null,
            'isExpired' => false, 'isBeforeUsageStart' => false,
            'rateScheduleId' => intval($rate['id']),
            'message' => 'No scope products for this company',
        ];
    }

    if ($quotaMode === 'confirm') {
        // ====== CONFIRM MODE ======
        $calcStart = $rate['calc_period_start'] ?? null;
        $calcEnd = $rate['calc_period_end'] ?? null;
        $usageStartDate = $rate['usage_start_date'] ?? $rate['effective_date'];
        $periodStart = $calcStart;
        $periodEnd = $calcEnd;

        if ($calcStart && $calcEnd) {
            // Sum sales across all scope products with per-product rates
            $totalPending = 0;
            foreach ($scopeProducts as $sp) {
                $qpId = intval($sp['quota_product_id']);
                $spRate = floatval($sp['sales_per_quota'] ?? 0) ?: $headerSalesPerQuota;
                $sales = _calcSalesInPeriod($conn, $userId, $qpId, $dateCol, $calcStart, $calcEnd);
                $totalSales += $sales;
                $totalPending += ($spRate > 0) ? floor($sales / $spRate) : 0;
            }
            $pendingAutoQuota = $totalPending;
        } else {
            $pendingAutoQuota = 0;
        }

        $requireConfirm = intval($rate['require_confirm'] ?? 1);
        if ($requireConfirm) {
            // Check confirmed allocations across all scope products
            $in = implode(',', array_map('intval', $scopeProductIds));
            $stmtConf = $conn->prepare("
                SELECT COALESCE(SUM(quantity), 0) AS confirmed_total
                FROM quota_allocations
                WHERE quota_product_id IN ($in) AND user_id = :uid AND source = 'auto_confirmed'
                AND source_detail = :rsId AND deleted_at IS NULL
            ");
            $stmtConf->execute([':uid' => $userId, ':rsId' => (string)$rate['id']]);
            $confirmedQuota = floatval($stmtConf->fetch()['confirmed_total']);
            $isConfirmed = $confirmedQuota > 0;
            $autoQuota = $confirmedQuota;
        } else {
            $isConfirmed = null;
            $autoQuota = $pendingAutoQuota;
        }

        // Check expiry
        $usageEndDate = $rate['usage_end_date'] ?? null;
        if ($usageEndDate && strlen($usageEndDate) >= 10 && date('Y-m-d') > $usageEndDate) {
            $isExpired = true;
        }
        if ($usageStartDate && date('Y-m-d') < $usageStartDate) {
            $autoQuota = 0;
            $isBeforeUsageStart = true;
        }

    } elseif ($quotaMode === 'reset') {
        // ====== RESET MODE (backward compat) ======
        $resetDayOfMonth = $rate['reset_day_of_month'] ? intval($rate['reset_day_of_month']) : null;
        if ($resetDayOfMonth) {
            $now = new DateTime();
            $cd = intval($now->format('j'));
            $cy = intval($now->format('Y'));
            $cm = intval($now->format('n'));
            if ($cd >= $resetDayOfMonth) {
                $ps = new DateTime("$cy-$cm-$resetDayOfMonth");
                $periodStart = $ps->format('Y-m-d');
                $periodEnd = (clone $ps)->modify('+1 month')->format('Y-m-d');
            } else {
                $pe = new DateTime("$cy-$cm-$resetDayOfMonth");
                $periodStart = (clone $pe)->modify('-1 month')->format('Y-m-d');
                $periodEnd = $pe->format('Y-m-d');
            }
        } else {
            $intervalDays = intval($rate['reset_interval_days']);
            $anchor = new DateTime($rate['reset_anchor_date'] ?: $rate['effective_date']);
            $now = new DateTime();
            if ($now < $anchor) {
                $periodStart = $anchor->format('Y-m-d');
                $periodEnd = (clone $anchor)->modify("+{$intervalDays} days")->format('Y-m-d');
            } else {
                $elapsed = floor(intval($anchor->diff($now)->days) / $intervalDays);
                $ps = (clone $anchor)->modify("+".($elapsed * $intervalDays)." days");
                $periodStart = $ps->format('Y-m-d');
                $periodEnd = (clone $ps)->modify("+{$intervalDays} days")->format('Y-m-d');
            }
        }
        // Sum across scope products
        foreach ($scopeProducts as $sp) {
            $qpId = intval($sp['quota_product_id']);
            $spRate = floatval($sp['sales_per_quota'] ?? 0) ?: $headerSalesPerQuota;
            $sales = _calcSalesInPeriod($conn, $userId, $qpId, $dateCol, $periodStart, $periodEnd);
            $totalSales += $sales;
            $autoQuota += ($spRate > 0) ? floor($sales / $spRate) : 0;
        }

    } elseif ($quotaMode === 'cumulative') {
        // ====== CUMULATIVE MODE (backward compat) ======
        $periodStart = $rate['effective_date'];
        $periodEnd = date('Y-m-d');
        foreach ($scopeProducts as $sp) {
            $qpId = intval($sp['quota_product_id']);
            $spRate = floatval($sp['sales_per_quota'] ?? 0) ?: $headerSalesPerQuota;
            $sales = _calcSalesInPeriod($conn, $userId, $qpId, $dateCol, $periodStart, $periodEnd);
            $totalSales += $sales;
            $autoQuota += ($spRate > 0) ? floor($sales / $spRate) : 0;
        }
    }

    // Admin-added quota — sum across scope products
    $in = implode(',', array_map('intval', $scopeProductIds));
    $adminQuery = "
        SELECT COALESCE(SUM(quantity), 0) AS admin_total
        FROM quota_allocations
        WHERE quota_product_id IN ($in) AND user_id = :userId AND source = 'admin' AND deleted_at IS NULL
        AND (valid_from IS NULL OR valid_from <= CURDATE())
        AND (valid_until IS NULL OR valid_until >= CURDATE())
    ";
    $adminParams = [':userId' => $userId];
    if ($quotaMode === 'reset') {
        $adminQuery .= " AND period_start = :ps AND period_end = :pe";
        $adminParams[':ps'] = $periodStart;
        $adminParams[':pe'] = $periodEnd;
    }
    $stmtAdmin = $conn->prepare($adminQuery);
    $stmtAdmin->execute($adminParams);
    $adminQuota = floatval($stmtAdmin->fetch()['admin_total']);

    // Usage — sum across scope products
    $usageQuery = "
        SELECT COALESCE(SUM(quantity_used), 0) AS total_used
        FROM quota_usage
        WHERE quota_product_id IN ($in) AND user_id = :userId AND deleted_at IS NULL
    ";
    $usageParams = [':userId' => $userId];
    if ($quotaMode === 'reset') {
        $usageQuery .= " AND period_start = :ps AND period_end = :pe";
        $usageParams[':ps'] = $periodStart;
        $usageParams[':pe'] = $periodEnd;
    }
    $stmtUsage = $conn->prepare($usageQuery);
    $stmtUsage->execute($usageParams);
    $totalUsed = floatval($stmtUsage->fetch()['total_used']);

    $totalQuota = $autoQuota + $adminQuota;
    $remaining = $totalQuota - $totalUsed;

    return [
        'autoQuota' => $autoQuota,
        'adminQuota' => $adminQuota,
        'totalQuota' => $totalQuota,
        'totalUsed' => $totalUsed,
        'remaining' => $remaining,
        'totalSales' => $totalSales,
        'salesPerQuota' => $headerSalesPerQuota,
        'quotaMode' => $quotaMode,
        'periodStart' => $periodStart,
        'periodEnd' => $periodEnd,
        'pendingAutoQuota' => $pendingAutoQuota,
        'isConfirmed' => $isConfirmed,
        'isExpired' => $isExpired,
        'usageEndDate' => $rate['usage_end_date'] ?? null,
        'requireConfirm' => isset($rate['require_confirm']) ? intval($rate['require_confirm']) : null,
        'isBeforeUsageStart' => $isBeforeUsageStart,
        'rateScheduleId' => intval($rate['id']),
    ];
}

// ============================================================
// Bulk Confirm Quota
// ============================================================

function handleBulkConfirmQuota(PDO $conn, array $data) {
    $rateScheduleId = intval($data['rateScheduleId'] ?? 0);
    $userIds = $data['userIds'] ?? [];
    $confirmedBy = intval($data['confirmedBy'] ?? 0) ?: null;
    $companyId = intval($data['companyId'] ?? 0);

    if (!$rateScheduleId || !is_array($userIds) || count($userIds) === 0) {
        json_response(['error' => 'rateScheduleId and userIds[] required'], 400);
    }

    $stmtRate = $conn->prepare("SELECT * FROM quota_rate_schedules WHERE id = :id AND deleted_at IS NULL");
    $stmtRate->execute([':id' => $rateScheduleId]);
    $rate = $stmtRate->fetch(PDO::FETCH_ASSOC);

    if (!$rate || $rate['quota_mode'] !== 'confirm') {
        json_response(['error' => 'Rate schedule not found or not in confirm mode'], 400);
    }

    $dateCol = ($rate['order_date_field'] === 'delivery_date') ? 'o.delivery_date' : 'o.order_date';
    $calcStart = $rate['calc_period_start'];
    $calcEnd = $rate['calc_period_end'];
    $headerSalesPerQuota = floatval($rate['sales_per_quota']);

    // Get scope products with per-product rates
    $scopeStmt = $conn->prepare("
        SELECT scope.quota_product_id, scope.sales_per_quota, qp.company_id
        FROM quota_rate_scope scope
        JOIN quota_products qp ON qp.id = scope.quota_product_id AND qp.deleted_at IS NULL
        WHERE scope.rate_schedule_id = :rid
    ");
    $scopeStmt->execute([':rid' => $rateScheduleId]);
    $scopeProducts = $scopeStmt->fetchAll(PDO::FETCH_ASSOC);
    $scopeProducts = array_filter($scopeProducts, function($sp) use ($companyId) { return intval($sp['company_id']) === $companyId; });
    $scopeProductIds = array_column($scopeProducts, 'quota_product_id');

    if (empty($scopeProductIds) || !$calcStart || !$calcEnd) {
        json_response(['error' => 'Rate schedule has no scope products or missing calc_period'], 400);
    }

    $results = [];
    foreach ($userIds as $uid) {
        $uid = intval($uid);
        if (!$uid) continue;

        // Calculate sales across scope products with per-product rates
        $totalSales = 0;
        $totalAutoQuota = 0;
        foreach ($scopeProducts as $sp) {
            $qpId = intval($sp['quota_product_id']);
            $spRate = floatval($sp['sales_per_quota'] ?? 0) ?: $headerSalesPerQuota;
            $sales = _calcSalesInPeriod($conn, $uid, $qpId, $dateCol, $calcStart, $calcEnd);
            $totalSales += $sales;
            $totalAutoQuota += ($spRate > 0) ? floor($sales / $spRate) : 0;
        }

        // Delete + re-insert per scope product
        foreach ($scopeProductIds as $qpId) {
            $qpId = intval($qpId);
            // Delete existing
            $conn->prepare("
                UPDATE quota_allocations SET deleted_at = NOW()
                WHERE quota_product_id = :qpId AND user_id = :uid AND source = 'auto_confirmed' AND source_detail = :rsId AND deleted_at IS NULL
            ")->execute([':qpId' => $qpId, ':uid' => $uid, ':rsId' => (string)$rateScheduleId]);
        }

        // Insert per scope product with pro-rata quota
        foreach ($scopeProducts as $sp) {
            $qpId = intval($sp['quota_product_id']);
            $spRate = floatval($sp['sales_per_quota'] ?? 0) ?: $headerSalesPerQuota;
            $sales = _calcSalesInPeriod($conn, $uid, $qpId, $dateCol, $calcStart, $calcEnd);
            $prodQuota = ($spRate > 0) ? floor($sales / $spRate) : 0;

            $conn->prepare("
                INSERT INTO quota_allocations (quota_product_id, user_id, company_id, quantity, source, source_detail, allocated_by, period_start, period_end)
                VALUES (:qpId, :uid, :cid, :qty, 'auto_confirmed', :rsId, :ab, :ps, :pe)
            ")->execute([
                ':qpId' => $qpId,
                ':uid' => $uid,
                ':cid' => $companyId,
                ':qty' => $prodQuota,
                ':rsId' => (string)$rateScheduleId,
                ':ab' => $confirmedBy,
                ':ps' => $calcStart,
                ':pe' => $calcEnd,
            ]);
        }

        $results[] = ['userId' => $uid, 'confirmedQuota' => $totalAutoQuota, 'totalSales' => $totalSales];
    }

    json_response([
        'success' => true,
        'confirmed' => count($results),
        'results' => $results,
    ]);
}

/**
 * Auto-record quota usage when an order is created.
 * Delegates to shared helper function recordQuotaUsageForOrder().
 */
function handleRecordOrderUsage(PDO $conn, array $data) {
    $orderId = trim($data['orderId'] ?? '');
    $companyId = intval($data['companyId'] ?? 0);
    $userId = intval($data['userId'] ?? 0);

    if (!$orderId || !$companyId || !$userId) {
        json_response(['error' => 'orderId, companyId, userId required'], 400);
    }

    $recorded = recordQuotaUsageForOrder($conn, $orderId, $companyId, $userId);
    json_response(['success' => true, 'recorded' => $recorded]);
}

// ============================================================
// Pending Counts — lightweight counts for confirm-mode rates
// ============================================================

function handlePendingCounts(PDO $conn) {
    $companyId = intval($_GET['companyId'] ?? 0);
    if (!$companyId) {
        json_response(['error' => 'companyId required'], 400);
    }

    // Get all confirm-mode rates via scope JOINs (only rates with company's products)
    $stmtRates = $conn->prepare("
        SELECT DISTINCT qrs.* FROM quota_rate_schedules qrs
        JOIN quota_rate_scope scope ON scope.rate_schedule_id = qrs.id
        JOIN quota_products qp ON qp.id = scope.quota_product_id AND qp.company_id = :companyId AND qp.deleted_at IS NULL
        WHERE qrs.deleted_at IS NULL AND qrs.quota_mode = 'confirm' AND qrs.require_confirm = 1
    ");
    $stmtRates->execute([':companyId' => $companyId]);
    $relevant = $stmtRates->fetchAll(PDO::FETCH_ASSOC);

    // Get active users
    $stmtUsers = $conn->prepare("
        SELECT id FROM users
        WHERE company_id = :companyId AND status = 'active'
        AND role IN ('Telesale', 'Supervisor Telesale', 'Admin Page')
    ");
    $stmtUsers->execute([':companyId' => $companyId]);
    $users = $stmtUsers->fetchAll(PDO::FETCH_COLUMN);

    $counts = [];
    foreach ($relevant as $rate) {
        $rateId = intval($rate['id']);
        $dateCol = ($rate['order_date_field'] === 'delivery_date') ? 'o.delivery_date' : 'o.order_date';
        $calcStart = $rate['calc_period_start'];
        $calcEnd = $rate['calc_period_end'];
        $headerSalesPerQuota = floatval($rate['sales_per_quota']);

        // Get scope products
        $scopeStmt = $conn->prepare("
            SELECT scope.quota_product_id, scope.sales_per_quota
            FROM quota_rate_scope scope
            JOIN quota_products qp ON qp.id = scope.quota_product_id AND qp.company_id = :cid AND qp.deleted_at IS NULL
            WHERE scope.rate_schedule_id = :rid
        ");
        $scopeStmt->execute([':rid' => $rateId, ':cid' => $companyId]);
        $scopeProducts = $scopeStmt->fetchAll(PDO::FETCH_ASSOC);

        if (!$calcStart || !$calcEnd || empty($scopeProducts)) {
            $counts[$rateId] = 0;
            continue;
        }

        $pending = 0;
        foreach ($users as $uid) {
            // Check if already confirmed
            $stmtConf = $conn->prepare("
                SELECT COUNT(*) FROM quota_allocations
                WHERE user_id = :uid AND source = 'auto_confirmed'
                AND source_detail = :rsId AND deleted_at IS NULL
            ");
            $stmtConf->execute([':uid' => $uid, ':rsId' => (string)$rateId]);
            if ($stmtConf->fetchColumn() > 0) continue;

            // Calculate total quota across scope products
            $totalQuota = 0;
            foreach ($scopeProducts as $sp) {
                $qpId = intval($sp['quota_product_id']);
                $spRate = floatval($sp['sales_per_quota'] ?? 0) ?: $headerSalesPerQuota;
                $sales = _calcSalesInPeriod($conn, $uid, $qpId, $dateCol, $calcStart, $calcEnd);
                $totalQuota += ($spRate > 0) ? floor($sales / $spRate) : 0;
            }
            if ($totalQuota > 0) {
                $pending++;
            }
        }
        $counts[$rateId] = $pending;
    }

    json_response(['success' => true, 'data' => $counts]);
}
