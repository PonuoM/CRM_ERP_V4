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
            case 'usage_breakdown':
                handleUsageBreakdown($conn);
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
            case 'transfer_quota':
                handleTransferQuota($conn, $data);
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
            ab.first_name AS allocated_by_first_name, ab.last_name AS allocated_by_last_name,
            qp.display_name AS product_name,
            qrs.rate_name AS rate_name
        FROM quota_allocations qa
        LEFT JOIN users u ON u.id = qa.user_id
        LEFT JOIN users ab ON ab.id = qa.allocated_by
        LEFT JOIN quota_products qp ON qp.id = qa.quota_product_id
        LEFT JOIN quota_rate_schedules qrs ON qrs.id = qa.rate_schedule_id
        $whereClause
        ORDER BY qa.created_at DESC
        LIMIT 200
    ");
    $stmt->execute($params);
    $allocations = $stmt->fetchAll(PDO::FETCH_ASSOC);

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
                JOIN orders o ON o.id = qu.order_id
                WHERE qu.quota_product_id = :qpId2 AND qu.deleted_at IS NULL
                AND o.order_status NOT IN ('Cancelled', 'Returned', 'ตีกลับ', 'ยกเลิก')
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
            'salesAtAllocation' => $calc['salesAtAllocation'] ?? null,
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

    $fields = ['quota_product_id = NULL']; // Enforce shared pool mode
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

    try {
        $conn->beginTransaction();
        
        // 1. Soft delete the rate schedule
        $conn->prepare("UPDATE quota_rate_schedules SET deleted_at = NOW() WHERE id = :id AND deleted_at IS NULL")->execute([':id' => $id]);
        
        // 2. Soft delete all auto_confirmed allocations that came from this rate schedule
        // This prevents the user from getting double points if the admin creates a new rate for the same period and confirms again.
        $conn->prepare("UPDATE quota_allocations SET deleted_at = NOW() WHERE rate_schedule_id = :id AND source = 'auto_confirmed' AND deleted_at IS NULL")->execute([':id' => $id]);
        
        $conn->commit();
        json_response(['success' => true]);
    } catch (Exception $e) {
        $conn->rollBack();
        json_response(['error' => $e->getMessage()], 500);
    }
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
        WHERE user_id = :uid AND source = 'auto_confirmed' AND rate_schedule_id = :rsId AND deleted_at IS NULL
    ")->execute([':uid' => $userId, ':rsId' => $rateScheduleId]);

    // Insert confirmed allocation (Shared Pool: quota_product_id = NULL)
    $conn->prepare("
        INSERT INTO quota_allocations (quota_product_id, rate_schedule_id, user_id, company_id, quantity, sales_at_allocation, source, source_detail, allocated_by, period_start, period_end)
        VALUES (NULL, :rsId, :uid, :cid, :qty, :sales, 'auto_confirmed', NULL, :ab, :ps, :pe)
    ")->execute([
        ':rsId' => $rateScheduleId,
        ':uid' => $userId,
        ':cid' => $companyId,
        ':qty' => $autoQuota,
        ':sales' => $totalSales,
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
                (quota_product_id, rate_schedule_id, user_id, company_id, quantity, source, source_detail, allocated_by, period_start, period_end, valid_from, valid_until)
            VALUES 
                (:qpId, :rsId, :userId, :companyId, :qty, :source, :detail, :allocBy, :ps, :pe, :vf, :vu)
        ");

    $stmt->execute([
        ':qpId' => $quotaProductId ?: null,
        ':rsId' => null, // Admin manual allocation is not currently tied to rate schedule from UI
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

function handleTransferQuota(PDO $conn, array $data) {
    $quotaProductId = intval($data['quotaProductId'] ?? 0);
    $fromUserId = intval($data['fromUserId'] ?? 0);
    $toUserId = intval($data['toUserId'] ?? 0);
    $companyId = intval($data['companyId'] ?? 0);
    $quantity = floatval($data['quantity'] ?? 0);
    $sourceDetail = $data['sourceDetail'] ?? null;
    $allocatedBy = intval($data['allocatedBy'] ?? 0) ?: null;

    if (!$fromUserId || !$toUserId || !$companyId || $quantity <= 0) {
        json_response(['error' => 'fromUserId, toUserId, companyId, quantity (>0) required'], 400);
    }

    try {
        $conn->beginTransaction();

        // [Validation] ตรวจสอบยอดโควตาคงเหลือของ fromUserId ในบริษัท และจัดสรรยอดโอนตาม quota_product_id
        $stmtRates = $conn->prepare("
            SELECT DISTINCT qrs.*, scope.quota_product_id FROM quota_rate_schedules qrs
            JOIN quota_rate_scope scope ON scope.rate_schedule_id = qrs.id
            JOIN quota_products qp ON qp.id = scope.quota_product_id AND qp.company_id = :companyId AND qp.deleted_at IS NULL
            WHERE qrs.deleted_at IS NULL
        ");
        $stmtRates->execute([':companyId' => $companyId]);
        $ratesForCompany = $stmtRates->fetchAll(PDO::FETCH_ASSOC);

        $uniqueRates = [];
        $seen = [];
        foreach ($ratesForCompany as $rate) {
            $key = $rate['id'];
            if (!isset($seen[$key])) {
                $uniqueRates[] = $rate;
                $seen[$key] = true;
            }
        }

        $availablePerRate = [];
        $totalRemaining = 0;
        foreach ($uniqueRates as $rate) {
            $calc = calculateQuotaByRate($conn, $rate, $fromUserId, $companyId);
            $rId = $rate['id'];
            if (!isset($availablePerRate[$rId])) {
                $availablePerRate[$rId] = 0;
            }
            $availablePerRate[$rId] += $calc['remaining'];
            $totalRemaining += $calc['remaining'];
        }

        if ($totalRemaining < $quantity) {
            throw new Exception("ยอดโควตาคงเหลือไม่เพียงพอ (โอนได้สูงสุด $totalRemaining แต้ม)");
        }

        $stmt = $conn->prepare("
            INSERT INTO quota_allocations 
                (quota_product_id, rate_schedule_id, user_id, company_id, quantity, source, source_detail, allocated_by)
            VALUES 
                (:qpId, :rsId, :userId, :companyId, :qty, 'transfer', :detail, :allocBy)
        ");

        $remainingToTransfer = $quantity;

        foreach ($availablePerRate as $rId => $avail) {
            if ($remainingToTransfer <= 0) break;
            if ($avail <= 0) continue;

            $transferAmount = min($avail, $remainingToTransfer);
            $remainingToTransfer -= $transferAmount;

            $sDetailDeduct = $sourceDetail ? "โอนให้ ID $toUserId: $sourceDetail" : "โอนให้ ID $toUserId";
            $sDetailAdd = $sourceDetail ? "รับโอนจาก ID $fromUserId: $sourceDetail" : "รับโอนจาก ID $fromUserId";

            // Deduct from Source (Use Shared Pool: NULL)
            $stmt->execute([
                ':qpId' => null,
                ':rsId' => $rId,
                ':userId' => $fromUserId,
                ':companyId' => $companyId,
                ':qty' => -$transferAmount,
                ':detail' => $sDetailDeduct,
                ':allocBy' => $allocatedBy,
            ]);

            // Add to Target (Use Shared Pool: NULL)
            $stmt->execute([
                ':qpId' => null,
                ':rsId' => $rId,
                ':userId' => $toUserId,
                ':companyId' => $companyId,
                ':qty' => $transferAmount,
                ':detail' => $sDetailAdd,
                ':allocBy' => $allocatedBy,
            ]);
        }

        $conn->commit();
        json_response(['success' => true]);
    } catch (Exception $e) {
        $conn->rollBack();
        json_response(['error' => 'Transfer failed: ' . $e->getMessage()], 500);
    }
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
    // หา company_id ของ User เพื่อส่งต่อให้ฟังก์ชันตัวใหม่
    $stmtCompany = $conn->prepare("SELECT company_id FROM users WHERE id = :userId");
    $stmtCompany->execute([':userId' => $userId]);
    $companyId = intval($stmtCompany->fetchColumn());

    // 1. Find all active rates that include this product in their scope
    $stmtRates = $conn->prepare("
        SELECT qrs.*, scope.sales_per_quota AS scope_sales_per_quota
        FROM quota_rate_schedules qrs
        JOIN quota_rate_scope scope ON scope.rate_schedule_id = qrs.id AND scope.quota_product_id = :qpId
        WHERE qrs.deleted_at IS NULL
    ");
    $stmtRates->execute([':qpId' => $quotaProductId]);
    $activeRates = $stmtRates->fetchAll(PDO::FETCH_ASSOC);

    if (empty($activeRates)) {
        // --- FALLBACK กรณีไม่มี Rate Schedule เลย ---
        $stmtAdmin = $conn->prepare("
            SELECT COALESCE(SUM(quantity), 0) AS admin_total FROM quota_allocations
            WHERE quota_product_id = :qpId AND user_id = :userId AND source IN ('admin', 'transfer') AND deleted_at IS NULL
            AND (valid_from IS NULL OR valid_from <= CURDATE())
            AND (valid_until IS NULL OR valid_until >= CURDATE())
        ");
        $stmtAdmin->execute([':qpId' => $quotaProductId, ':userId' => $userId]);
        $adminQuota = floatval($stmtAdmin->fetch()['admin_total']);

        $stmtUsage = $conn->prepare("
            SELECT COALESCE(SUM(qu.quantity_used), 0) AS total_used 
            FROM quota_usage qu
            JOIN orders o ON o.id = qu.order_id
            WHERE qu.quota_product_id = :qpId AND qu.user_id = :userId AND qu.deleted_at IS NULL
            AND o.order_status NOT IN ('Cancelled', 'Returned', 'ตีกลับ', 'ยกเลิก')
        ");
        $stmtUsage->execute([':qpId' => $quotaProductId, ':userId' => $userId]);
        $totalUsed = floatval($stmtUsage->fetch()['total_used']);

        $totalQuota = $adminQuota;
        $remaining = $totalQuota - $totalUsed;

        return [
            'autoQuota' => 0,
            'adminQuota' => $adminQuota,
            'totalQuota' => $totalQuota,
            'totalUsed' => $totalUsed,
            'remaining' => $remaining,
            'totalSales' => 0,
            'salesPerQuota' => 0,
            'quotaMode' => 'N/A',
            'periodStart' => null,
            'periodEnd' => null,
            'pendingAutoQuota' => 0,
            'isConfirmed' => null,
            'isExpired' => false,
            'usageEndDate' => null,
            'requireConfirm' => null,
            'isBeforeUsageStart' => false,
            'rateScheduleId' => null,
        ];
    }

    // 2. มีกติกา (Rates) ใช้งาน ให้เตรียมตะกร้า (Buckets) สำหรับ Dynamic Bin Packing
    $buckets = [];
    $allScopeProductIds = [];
    $aggregate = [
        'autoQuota' => 0,
        'adminQuota' => 0,
        'totalQuota' => 0,
        'pendingAutoQuota' => 0,
    ];

    foreach ($activeRates as $rate) {
        $rateData = calculateQuotaByRate($conn, $rate, $userId, $companyId);
        
        // ถ้าตะกร้านี้หมดอายุ หรือยังไม่ถึงเวลาเริ่มใช้ จะไม่นำมารวมความจุ (Capacity) ในปัจจุบัน
        if ($rateData['isExpired'] || $rateData['isBeforeUsageStart']) {
            continue;
        }

        // ดึงรายการสินค้าทั้งหมดที่อยู่ใน Scope ของตะกร้านี้
        $stmtScope = $conn->prepare("SELECT quota_product_id FROM quota_rate_scope WHERE rate_schedule_id = :rid");
        $stmtScope->execute([':rid' => $rate['id']]);
        $scopeIds = $stmtScope->fetchAll(PDO::FETCH_COLUMN);

        $buckets[] = [
            'id' => $rate['id'],
            'rate_name' => $rate['rate_name'],
            'scope_products' => $scopeIds,
            // ความจุของตะกร้า = totalQuota ที่คำนวณมา (รวมแอดมิน, ตัดหนี้ในอดีตแล้ว)
            'capacity' => floatval($rateData['totalQuota']),
            'end_date' => $rate['usage_end_date'] ?: '2099-12-31',
            'start_date' => $rate['usage_start_date'] ?: '1970-01-01',
        ];

        foreach ($scopeIds as $sid) {
            $allScopeProductIds[$sid] = true;
        }

        $aggregate['autoQuota'] += $rateData['autoQuota'];
        $aggregate['adminQuota'] += $rateData['adminQuota'];
        $aggregate['totalQuota'] += $rateData['totalQuota'];
        $aggregate['pendingAutoQuota'] += $rateData['pendingAutoQuota'];

        // ใช้ metadata ของ rate แรกที่เจอเป็นตัวตั้งต้นสำหรับส่งให้ UI
        if (!isset($aggregate['quotaMode'])) {
            $aggregate['quotaMode'] = $rateData['quotaMode'];
            $aggregate['periodStart'] = $rateData['periodStart'];
            $aggregate['periodEnd'] = $rateData['periodEnd'];
            $aggregate['isConfirmed'] = $rateData['isConfirmed'];
            $aggregate['requireConfirm'] = $rateData['requireConfirm'];
        }
    }

    if (empty($buckets)) {
        // ทุก Rate ที่เกี่ยวข้องหมดอายุไปหมดแล้ว
        return [
            'autoQuota' => 0, 'adminQuota' => 0, 'totalQuota' => 0, 'totalUsed' => 0, 'remaining' => 0,
            'totalSales' => 0, 'salesPerQuota' => 0, 'quotaMode' => 'N/A', 'periodStart' => null, 'periodEnd' => null,
            'pendingAutoQuota' => 0, 'isConfirmed' => null, 'isExpired' => true, 'usageEndDate' => null,
            'requireConfirm' => null, 'isBeforeUsageStart' => false, 'rateScheduleId' => null,
        ];
    }

    // 3. ดึงประวัติการใช้ (Raw Usages) ของสินค้าที่เกี่ยวข้องทั้งหมด
    $inClause = implode(',', array_map('intval', array_keys($allScopeProductIds)));
    $stmtU = $conn->prepare("
        SELECT qu.quota_product_id, qu.quantity_used, qu.created_at 
        FROM quota_usage qu
        JOIN orders o ON o.id = qu.order_id
        WHERE qu.user_id = :uid 
        AND qu.quota_product_id IN ($inClause) 
        AND qu.deleted_at IS NULL 
        AND o.order_status NOT IN ('Cancelled', 'Returned', 'ตีกลับ', 'ยกเลิก')
    ");
    $stmtU->execute([':uid' => $userId]);
    $rawUsages = $stmtU->fetchAll(PDO::FETCH_ASSOC);

    // หา minStart, maxEnd สำหรับแสดง totalUsed ของสินค้านี้
    $minStart = '2099-12-31 00:00:00';
    $maxEnd = '1970-01-01 23:59:59';

    // 4. จัดเรียงลำดับความสำคัญของตะกร้า (Dynamic Sorting Priority)
    usort($buckets, function($a, $b) {
        $countA = count($a['scope_products']);
        $countB = count($b['scope_products']);
        if ($countA !== $countB) {
            return $countA - $countB; // 1. เจาะจงมากที่สุดก่อน (ขอบเขตแคบสุด)
        }
        if ($a['end_date'] !== $b['end_date']) {
            return strtotime($a['end_date']) - strtotime($b['end_date']); // 2. ใกล้หมดอายุที่สุดก่อน
        }
        return $a['id'] - $b['id']; // 3. สร้างก่อน
    });

    // 5. เทของลงตะกร้า (Dynamic Bin Packing)
    foreach ($buckets as &$bucket) {
        $bucket['remaining'] = $bucket['capacity'];
        $bStart = $bucket['start_date'] . ' 00:00:00';
        $bEnd   = $bucket['end_date'] . ' 23:59:59';
        
        if ($bStart < $minStart) $minStart = $bStart;
        if ($bEnd > $maxEnd) $maxEnd = $bEnd;
        
        foreach ($rawUsages as $k => $usage) {
            // ถ้ายอดใช้นี้ตรงกับสินค้าใน Scope ของตะกร้า
            if (in_array($usage['quota_product_id'], $bucket['scope_products'])) {
                // ถ้ายอดใช้นี้เกิดขึ้นในช่วงเวลาที่ตะกร้านี้เปิดให้ใช้งาน
                if ($usage['created_at'] >= $bStart && $usage['created_at'] <= $bEnd) {
                    if (floatval($usage['quantity_used']) > 0 && $bucket['remaining'] > 0) {
                        $deduct = min($bucket['remaining'], floatval($usage['quantity_used']));
                        $bucket['remaining'] -= $deduct;
                        $rawUsages[$k]['quantity_used'] -= $deduct; // หักลดยอดที่หาที่ลงได้แล้ว
                    }
                }
            }
        }
    }

    // 6. สรุปผลยอดโควตาคงเหลือ "เฉพาะสินค้าที่ถูกเรียกดู (quotaProductId)"
    $remainingForProduct = 0;
    foreach ($buckets as $bucket) {
        if (in_array($quotaProductId, $bucket['scope_products'])) {
            $remainingForProduct += $bucket['remaining'];
        }
    }

    // หา totalUsed ของสินค้านี้จริงๆ (รวมยอดตามช่วงเวลาที่ Rate Active)
    $stmtUU = $conn->prepare("
        SELECT COALESCE(SUM(qu.quantity_used), 0) 
        FROM quota_usage qu
        JOIN orders o ON o.id = qu.order_id
        WHERE qu.user_id = :uid 
        AND qu.quota_product_id = :qpId 
        AND qu.created_at >= :start AND qu.created_at <= :end 
        AND qu.deleted_at IS NULL
        AND o.order_status NOT IN ('Cancelled', 'Returned', 'ตีกลับ', 'ยกเลิก')
    ");
    $stmtUU->execute([':uid' => $userId, ':qpId' => $quotaProductId, ':start' => $minStart, ':end' => $maxEnd]);
    $totalUsedUI = floatval($stmtUU->fetchColumn());

    $aggregate['totalUsed'] = $totalUsedUI;
    $aggregate['remaining'] = $remainingForProduct;
    if (!isset($aggregate['isExpired'])) {
        $aggregate['isExpired'] = false;
        $aggregate['usageEndDate'] = null;
        $aggregate['isBeforeUsageStart'] = false;
        $aggregate['rateScheduleId'] = null;
    }

    return $aggregate;
}

/**
 * Helper: Calculate total sales for a user within a date range.
 * Uses oi.creator_id (not o.creator_id) to include upsell items.
 * Uses oi.parent_order_id (not oi.order_id) for JOIN because order_items.order_id has -1 suffix.
 */
function _calcSalesInPeriod(PDO $conn, int $userId, int $quotaProductId, string $dateCol, string $periodStart, string $periodEnd): float {
    $stmt = $conn->prepare("
        SELECT COALESCE(SUM(
            CASE WHEN (oi.is_freebie = 0 OR oi.is_freebie IS NULL) AND oi.parent_item_id IS NULL
                 THEN COALESCE(oi.net_total, oi.quantity * oi.price_per_unit)
                 ELSE 0 END
        ), 0) AS total_sales
        FROM order_items oi
        JOIN orders o ON o.id = oi.parent_order_id
        WHERE oi.creator_id = :userId
        AND o.company_id = (SELECT company_id FROM quota_products WHERE id = :qpId AND deleted_at IS NULL)
        AND o.order_status NOT IN ('Cancelled', 'Returned', 'ตีกลับ', 'ยกเลิก')
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

    // Get active users based on role
    $authUser = get_authenticated_user($conn);
    $authUserId = intval($authUser['id'] ?? 0);
    $authRole = $authUser['role'] ?? '';

    $whereClause = "company_id = :companyId AND status = 'active' AND role IN ('Telesale', 'Supervisor Telesale', 'Admin Page')";
    $params = [':companyId' => $companyId];

    $isSystem = intval($authUser['is_system'] ?? 0) === 1;

    if (!$isSystem) {
        if ($authRole === 'Telesale') {
            $whereClause .= " AND id = :authUserId";
            $params[':authUserId'] = $authUserId;
        } elseif ($authRole === 'Supervisor Telesale') {
            $whereClause .= " AND :authUserId IN (id, supervisor_id)";
            $params[':authUserId'] = $authUserId;
        }
    }

    $stmtUsers = $conn->prepare("
        SELECT id, first_name, last_name, role
        FROM users
        WHERE $whereClause
        ORDER BY first_name ASC
    ");
    $stmtUsers->execute($params);
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
            'salesAtAllocation' => $calc['salesAtAllocation'] ?? null,
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
            'scopeIds' => $scopeIds,
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
            $firstQpId = intval($scopeProducts[0]['quota_product_id']);
            $totalSales = _calcSalesInPeriod($conn, $userId, $firstQpId, $dateCol, $calcStart, $calcEnd);
            $pendingAutoQuota = ($headerSalesPerQuota > 0) ? floor($totalSales / $headerSalesPerQuota) : 0;
        } else {
            $pendingAutoQuota = 0;
        }

        $requireConfirm = intval($rate['require_confirm'] ?? 1);
        if ($requireConfirm) {
            $stmtConf = $conn->prepare("
                SELECT COALESCE(SUM(quantity), 0) AS confirmed_total,
                       MAX(sales_at_allocation) AS sales_at_allocation
                FROM quota_allocations
                WHERE user_id = :uid AND source = 'auto_confirmed'
                AND rate_schedule_id = :rsId AND deleted_at IS NULL
            ");
            $stmtConf->execute([':uid' => $userId, ':rsId' => (string)$rate['id']]);
            $confRow = $stmtConf->fetch(PDO::FETCH_ASSOC);
            $confirmedQuota = floatval($confRow['confirmed_total']);
            $salesAtAllocation = $confRow['sales_at_allocation'] !== null ? floatval($confRow['sales_at_allocation']) : null;
            $isConfirmed = $confirmedQuota > 0;
            $autoQuota = $confirmedQuota;
        } else {
            $isConfirmed = null;
            $autoQuota = $pendingAutoQuota;
            $salesAtAllocation = null;
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
        if (!empty($scopeProducts)) {
            $firstQpId = intval($scopeProducts[0]['quota_product_id']);
            $totalSales = _calcSalesInPeriod($conn, $userId, $firstQpId, $dateCol, $periodStart, $periodEnd);
            $autoQuota = ($headerSalesPerQuota > 0) ? floor($totalSales / $headerSalesPerQuota) : 0;
        }

    } elseif ($quotaMode === 'cumulative') {
        // ====== CUMULATIVE MODE (backward compat) ======
        $periodStart = $rate['effective_date'];
        $periodEnd = date('Y-m-d');
        if (!empty($scopeProducts)) {
            $firstQpId = intval($scopeProducts[0]['quota_product_id']);
            $totalSales = _calcSalesInPeriod($conn, $userId, $firstQpId, $dateCol, $periodStart, $periodEnd);
            $autoQuota = ($headerSalesPerQuota > 0) ? floor($totalSales / $headerSalesPerQuota) : 0;
        }
    }

    // Admin-added quota — sum across scope products
    $in = implode(',', array_map('intval', $scopeProductIds));
    $adminQuery = "
        SELECT COALESCE(SUM(quantity), 0) AS admin_total
        FROM quota_allocations
        WHERE (quota_product_id IN ($in) OR (quota_product_id IS NULL AND rate_schedule_id = :rsId))
        AND user_id = :userId AND source IN ('admin', 'transfer') AND deleted_at IS NULL
        AND (valid_from IS NULL OR valid_from <= CURDATE())
        AND (valid_until IS NULL OR valid_until >= CURDATE())
    ";
    $adminParams = [':userId' => $userId, ':rsId' => $rate['id']];
    if ($quotaMode === 'reset') {
        $adminQuery .= " AND period_start = :ps AND period_end = :pe";
        $adminParams[':ps'] = $periodStart;
        $adminParams[':pe'] = $periodEnd;
    }
    $stmtAdmin = $conn->prepare($adminQuery);
    $stmtAdmin->execute($adminParams);
    $adminQuota = floatval($stmtAdmin->fetch()['admin_total']);

    // Usage — sum across scope products
    $in = implode(',', array_map('intval', $scopeProductIds));
    $carriedDebt = 0;

    if ($quotaMode === 'confirm') {
        // [NEW] 1. หารายการรอบบิลโควตาทั้งหมดในอดีตที่เกี่ยวกับสินค้านี้ เรียงตามเวลา
        $stmtRates = $conn->prepare("
            SELECT rs.id, rs.usage_start_date, rs.usage_end_date
            FROM quota_rate_schedules rs
            JOIN quota_rate_scope scope ON scope.rate_schedule_id = rs.id
            WHERE scope.quota_product_id IN ($in) 
              AND rs.quota_mode = 'confirm' 
              AND rs.deleted_at IS NULL
            GROUP BY rs.id, rs.usage_start_date, rs.usage_end_date
            ORDER BY rs.usage_start_date ASC
        ");
        $stmtRates->execute();
        $historyRates = $stmtRates->fetchAll(PDO::FETCH_ASSOC);

        // [NEW] 2. Loop คำนวณทีละรอบบิลเพื่อหายอดยกมา (carried debt)
        foreach ($historyRates as $hr) {
            if ($hr['id'] == $rate['id']) {
                break; // ถึงรอบปัจจุบัน ให้หยุด loop
            }

            // A. หารายรับของรอบบิลนั้นๆ (รวม Auto, Transfer และ Admin)
            $sConf = $conn->prepare("SELECT COALESCE(SUM(quantity), 0) FROM quota_allocations WHERE user_id = :uid AND source IN ('auto_confirmed', 'admin', 'transfer') AND rate_schedule_id = :rsId AND deleted_at IS NULL");
            $sConf->execute([':uid' => $userId, ':rsId' => (string)$hr['id']]);
            $histIncome = floatval($sConf->fetchColumn());

            // B. หารายจ่ายของรอบบิลนั้นๆ
            $sUsage = $conn->prepare("SELECT COALESCE(SUM(qu.quantity_used), 0) FROM quota_usage qu JOIN orders o ON o.id = qu.order_id WHERE qu.user_id = :uid AND qu.quota_product_id IN ($in) AND qu.created_at >= :start AND qu.created_at <= :end AND qu.deleted_at IS NULL AND o.order_status NOT IN ('Cancelled', 'Returned', 'ตีกลับ', 'ยกเลิก')");
            $start = ($hr['usage_start_date'] ?: '1970-01-01') . ' 00:00:00';
            $end = ($hr['usage_end_date'] ?: '2099-12-31') . ' 23:59:59';
            $sUsage->execute([':uid' => $userId, ':start' => $start, ':end' => $end]);
            $histUsage = floatval($sUsage->fetchColumn());

            // C. คำนวณสมดุล (Balance)
            $balance = $histIncome + $carriedDebt - $histUsage;

            // D. ตัดบวก ทบลบ!
            if ($balance < 0) {
                $carriedDebt = $balance; // ติดลบ ยกยอดไป
            } else {
                $carriedDebt = 0; // เป็นบวก หมดอายุ
            }
        }
    }

    $usageQuery = "
        SELECT COALESCE(SUM(qu.quantity_used), 0) AS total_used
        FROM quota_usage qu
        JOIN orders o ON o.id = qu.order_id
        WHERE qu.quota_product_id IN ($in) AND qu.user_id = :userId AND qu.deleted_at IS NULL
        AND o.order_status NOT IN ('Cancelled', 'Returned', 'ตีกลับ', 'ยกเลิก')
    ";
    $usageParams = [':userId' => $userId];
    if ($quotaMode === 'reset') {
        $usageQuery .= " AND qu.period_start = :ps AND qu.period_end = :pe";
        $usageParams[':ps'] = $periodStart;
        $usageParams[':pe'] = $periodEnd;
    } elseif ($quotaMode === 'confirm') {
        if (!empty($rate['usage_start_date'])) {
            $usageQuery .= " AND qu.created_at >= :usgStart";
            $usageParams[':usgStart'] = $rate['usage_start_date'] . ' 00:00:00';
        }
        if (!empty($rate['usage_end_date'])) {
            $usageQuery .= " AND qu.created_at <= :usgEnd";
            $usageParams[':usgEnd'] = $rate['usage_end_date'] . ' 23:59:59';
        }
    }
    
    $stmtUsage = $conn->prepare($usageQuery);
    $stmtUsage->execute($usageParams);
    $currentPeriodUsage = floatval($stmtUsage->fetch()['total_used']);

    if ($quotaMode === 'confirm') {
        $totalUsed = $currentPeriodUsage + abs($carriedDebt);
    } else {
        $totalUsed = $currentPeriodUsage;
    }

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
        'salesAtAllocation' => $salesAtAllocation ?? null,
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

        // Calculate sales ONCE for the rate schedule (Shared Pool)
        $firstQpId = intval($scopeProducts[0]['quota_product_id']);
        $totalSales = _calcSalesInPeriod($conn, $uid, $firstQpId, $dateCol, $calcStart, $calcEnd);
        $totalAutoQuota = ($headerSalesPerQuota > 0) ? floor($totalSales / $headerSalesPerQuota) : 0;

        // Delete existing shared allocations for this rate
        $conn->prepare("
            UPDATE quota_allocations SET deleted_at = NOW()
            WHERE user_id = :uid AND source = 'auto_confirmed' AND rate_schedule_id = :rsId AND deleted_at IS NULL
        ")->execute([':uid' => $uid, ':rsId' => (string)$rateScheduleId]);

        // Insert 1 shared allocation per rate (quota_product_id = NULL)
        $conn->prepare("
            INSERT INTO quota_allocations (quota_product_id, rate_schedule_id, user_id, company_id, quantity, sales_at_allocation, source, source_detail, allocated_by, period_start, period_end)
            VALUES (NULL, :rsId, :uid, :cid, :qty, :sales, 'auto_confirmed', NULL, :ab, :ps, :pe)
        ")->execute([
            ':rsId' => $rateScheduleId,
            ':uid' => $uid,
            ':cid' => $companyId,
            ':qty' => $totalAutoQuota,
            ':sales' => $totalSales,
            ':ab' => $confirmedBy,
            ':ps' => $calcStart,
            ':pe' => $calcEnd,
        ]);

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

    // Get active users based on role
    $authUser = get_authenticated_user($conn);
    $authUserId = intval($authUser['id'] ?? 0);
    $authRole = $authUser['role'] ?? '';

    $whereClause = "company_id = :companyId AND status = 'active' AND role IN ('Telesale', 'Supervisor Telesale', 'Admin Page')";
    $params = [':companyId' => $companyId];

    $isSystem = intval($authUser['is_system'] ?? 0) === 1;

    if (!$isSystem) {
        if ($authRole === 'Telesale') {
            $whereClause .= " AND id = :authUserId";
            $params[':authUserId'] = $authUserId;
        } elseif ($authRole === 'Supervisor Telesale') {
            $whereClause .= " AND :authUserId IN (id, supervisor_id)";
            $params[':authUserId'] = $authUserId;
        }
    }

    $stmtUsers = $conn->prepare("
        SELECT id FROM users
        WHERE $whereClause
    ");
    $stmtUsers->execute($params);
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
                AND rate_schedule_id = :rsId AND deleted_at IS NULL
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

function handleUsageBreakdown(PDO $conn) {
    $companyId = intval($_GET['companyId'] ?? 0);
    $userId = intval($_GET['userId'] ?? 0);
    $rateScheduleId = $_GET['rateScheduleId'] ?? 'all';

    if (!$companyId || !$userId) {
        json_response(['error' => 'Missing required parameters'], 400);
    }

    // Base query
    $sql = "
        SELECT 
            qu.id,
            qu.order_id, 
            qu.quantity_used, 
            qu.created_at, 
            qp.display_name as product_name,
            (
                SELECT COALESCE(SUM(oi.quantity), 0) 
                FROM order_items oi 
                WHERE oi.order_id = qu.order_id 
                AND oi.product_id = qp.product_id 
                AND (oi.is_freebie = 0 OR oi.is_freebie IS NULL)
            ) as item_quantity
        FROM quota_usage qu
        JOIN quota_products qp ON qp.id = qu.quota_product_id
        JOIN orders o ON o.id = qu.order_id
        WHERE qu.user_id = :userId 
          AND qu.company_id = :companyId
          AND qu.deleted_at IS NULL
          AND o.order_status NOT IN ('Cancelled', 'Returned', 'ตีกลับ', 'ยกเลิก')
    ";

    $params = [
        ':userId' => $userId,
        ':companyId' => $companyId
    ];

    // If a specific rate is selected, filter by the scope of that rate
    if ($rateScheduleId !== 'all') {
        $stmtScope = $conn->prepare("SELECT quota_product_id FROM quota_rate_scope WHERE rate_schedule_id = :rid");
        $stmtScope->execute([':rid' => $rateScheduleId]);
        $scopeIds = $stmtScope->fetchAll(PDO::FETCH_COLUMN);

        if (empty($scopeIds)) {
            // Rate has no scope, which means it applies to NO products (should not happen usually, but handle it)
            json_response(['success' => true, 'data' => []]);
        }

        $inClause = implode(',', array_map('intval', $scopeIds));
        $sql .= " AND qu.quota_product_id IN ($inClause)";
    }

    $sql .= " ORDER BY qu.created_at DESC";

    $stmt = $conn->prepare($sql);
    $stmt->execute($params);
    $usages = $stmt->fetchAll(PDO::FETCH_ASSOC);

    json_response(['success' => true, 'data' => $usages]);
}
