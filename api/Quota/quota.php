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
    $raw = $_GET['quotaProductId'] ?? '';
    $isGlobal = ($raw === 'global' || $raw === '0');
    $quotaProductId = intval($raw);
    if (!$isGlobal && !$quotaProductId) {
        json_response(['error' => 'quotaProductId required'], 400);
    }

    // Get currently active rate (effective_date <= NOW, latest)
    if ($isGlobal) {
        $stmt = $conn->prepare("
            SELECT * FROM quota_rate_schedules
            WHERE quota_product_id IS NULL AND effective_date <= CURDATE() AND deleted_at IS NULL
            ORDER BY effective_date DESC
            LIMIT 1
        ");
        $stmt->execute();
    } else {
        $stmt = $conn->prepare("
            SELECT * FROM quota_rate_schedules
            WHERE quota_product_id = :qpId AND effective_date <= CURDATE() AND deleted_at IS NULL
            ORDER BY effective_date DESC
            LIMIT 1
        ");
        $stmt->execute([':qpId' => $quotaProductId]);
    }
    $rate = $stmt->fetch();

    json_response(['success' => true, 'data' => $rate ?: null]);
}

function handleListRates(PDO $conn) {
    $raw = $_GET['quotaProductId'] ?? '';
    $isGlobal = ($raw === 'global' || $raw === '0');
    $quotaProductId = intval($raw);
    if (!$isGlobal && !$quotaProductId) {
        json_response(['error' => 'quotaProductId required'], 400);
    }

    if ($isGlobal) {
        $stmt = $conn->prepare("
            SELECT qrs.*, u.first_name AS created_by_name
            FROM quota_rate_schedules qrs
            LEFT JOIN users u ON u.id = qrs.created_by
            WHERE qrs.quota_product_id IS NULL AND qrs.deleted_at IS NULL
            ORDER BY qrs.effective_date DESC
        ");
        $stmt->execute();
    } else {
        $stmt = $conn->prepare("
            SELECT qrs.*, u.first_name AS created_by_name
            FROM quota_rate_schedules qrs
            LEFT JOIN users u ON u.id = qrs.created_by
            WHERE qrs.quota_product_id = :qpId AND qrs.deleted_at IS NULL
            ORDER BY qrs.effective_date DESC
        ");
        $stmt->execute([':qpId' => $quotaProductId]);
    }
    $rates = $stmt->fetchAll();

    // Attach scope product IDs for each rate
    foreach ($rates as &$rate) {
        $stmtScope = $conn->prepare("SELECT quota_product_id FROM quota_rate_scope WHERE rate_schedule_id = :rid");
        $stmtScope->execute([':rid' => $rate['id']]);
        $rate['scope_product_ids'] = array_column($stmtScope->fetchAll(), 'quota_product_id');
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

    // Get all active users in the company (Telesale + Supervisor)
    $stmt = $conn->prepare("
        SELECT id, first_name, last_name, role
        FROM users
        WHERE company_id = :companyId AND status = 'active'
        AND role IN ('Telesale', 'Supervisor Telesale')
        ORDER BY first_name ASC
    ");
    $stmt->execute([':companyId' => $companyId]);
    $users = $stmt->fetchAll();

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
    $quotaProductId = intval($data['quotaProductId'] ?? 0);
    $salesPerQuota = floatval($data['salesPerQuota'] ?? 0);
    $effectiveDate = $data['effectiveDate'] ?? '';
    $orderDateField = $data['orderDateField'] ?? 'order_date';
    $quotaMode = $data['quotaMode'] ?? 'reset';
    $resetIntervalDays = intval($data['resetIntervalDays'] ?? 30);
    $resetDayOfMonth = isset($data['resetDayOfMonth']) ? intval($data['resetDayOfMonth']) : null;
    $resetAnchorDate = $data['resetAnchorDate'] ?? null;
    $createdBy = intval($data['createdBy'] ?? 0) ?: null;

    if ($salesPerQuota <= 0 || !$effectiveDate) {
        json_response(['error' => 'salesPerQuota (>0), effectiveDate required'], 400);
    }

    if (!in_array($orderDateField, ['order_date', 'delivery_date'])) {
        $orderDateField = 'order_date';
    }
    if (!in_array($quotaMode, ['reset', 'cumulative', 'confirm'])) {
        $quotaMode = 'reset';
    }
    // Validate day of month (1-28)
    if ($resetDayOfMonth !== null && ($resetDayOfMonth < 1 || $resetDayOfMonth > 28)) {
        $resetDayOfMonth = null;
    }

    // Confirm mode fields — coerce empty strings to null
    $calcPeriodStart = !empty($data['calcPeriodStart']) ? $data['calcPeriodStart'] : null;
    $calcPeriodEnd = !empty($data['calcPeriodEnd']) ? $data['calcPeriodEnd'] : null;
    $usageStartDate = !empty($data['usageStartDate']) ? $data['usageStartDate'] : null;
    $usageEndDate = !empty($data['usageEndDate']) ? $data['usageEndDate'] : null;
    $requireConfirm = isset($data['requireConfirm']) ? (intval($data['requireConfirm']) ? 1 : 0) : 1;

    $stmt = $conn->prepare("
        INSERT INTO quota_rate_schedules 
            (quota_product_id, sales_per_quota, effective_date, order_date_field, quota_mode, reset_interval_days, reset_day_of_month, reset_anchor_date, calc_period_start, calc_period_end, usage_start_date, usage_end_date, require_confirm, created_by)
        VALUES 
            (:qpId, :sPerQ, :effDate, :odf, :qm, :rid, :rdom, :rad, :cps, :cpe, :usd, :ued, :rc, :cb)
    ");
    $stmt->execute([
        ':qpId' => $quotaProductId ?: null,
        ':sPerQ' => $salesPerQuota,
        ':effDate' => $effectiveDate,
        ':odf' => $orderDateField,
        ':qm' => $quotaMode,
        ':rid' => $resetIntervalDays,
        ':rdom' => $resetDayOfMonth,
        ':rad' => $resetAnchorDate,
        ':cb' => $createdBy,
        ':cps' => $calcPeriodStart,
        ':cpe' => $calcPeriodEnd,
        ':usd' => $usageStartDate,
        ':ued' => $usageEndDate,
        ':rc' => $requireConfirm,
    ]);

    $newRateId = $conn->lastInsertId();

    // Insert scope rows if provided (multi-product)
    $scopeProductIds = $data['scopeProductIds'] ?? [];
    if (!empty($scopeProductIds) && is_array($scopeProductIds)) {
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
    if (isset($data['quotaMode'])) {
        $qm = in_array($data['quotaMode'], ['reset', 'cumulative', 'confirm']) ? $data['quotaMode'] : 'reset';
        $fields[] = 'quota_mode = :qm';
        $params[':qm'] = $qm;
    }
    if (isset($data['resetIntervalDays'])) {
        $fields[] = 'reset_interval_days = :rid';
        $params[':rid'] = intval($data['resetIntervalDays']);
    }
    if (array_key_exists('resetDayOfMonth', $data)) {
        $dom = $data['resetDayOfMonth'] !== null ? intval($data['resetDayOfMonth']) : null;
        if ($dom !== null && ($dom < 1 || $dom > 28)) $dom = null;
        $fields[] = 'reset_day_of_month = :rdom';
        $params[':rdom'] = $dom;
    }
    if (array_key_exists('resetAnchorDate', $data)) {
        $fields[] = 'reset_anchor_date = :rad';
        $params[':rad'] = $data['resetAnchorDate'];
    }
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

    if (empty($fields)) {
        json_response(['error' => 'No fields to update'], 400);
    }

    $sql = "UPDATE quota_rate_schedules SET " . implode(', ', $fields) . " WHERE id = :id";
    $conn->prepare($sql)->execute($params);

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

    // Calculate auto quota from the specified order date range
    $dateCol = ($rate['order_date_field'] === 'delivery_date') ? 'o.delivery_date' : 'o.order_date';
    $calcStart = $rate['calc_period_start'];
    $calcEnd = $rate['calc_period_end'];
    $salesPerQuota = floatval($rate['sales_per_quota']);

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
    $usageStart = $rate['usage_start_date'] ?? $rate['effective_date'];
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

    if (!$quotaProductId || !$userId || !$companyId || $quantity <= 0) {
        json_response(['error' => 'quotaProductId, userId, companyId, quantity (>0) required'], 400);
    }

    $stmt = $conn->prepare("
        INSERT INTO quota_allocations 
            (quota_product_id, user_id, company_id, quantity, source, source_detail, allocated_by, period_start, period_end)
        VALUES 
            (:qpId, :userId, :companyId, :qty, :source, :detail, :allocBy, :ps, :pe)
    ");
    $stmt->execute([
        ':qpId' => $quotaProductId,
        ':userId' => $userId,
        ':companyId' => $companyId,
        ':qty' => $quantity,
        ':source' => $source,
        ':detail' => $sourceDetail,
        ':allocBy' => $allocatedBy,
        ':ps' => $periodStart,
        ':pe' => $periodEnd,
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
    // 1. Get the latest active rate schedule
    $stmtRate = $conn->prepare("
        SELECT * FROM quota_rate_schedules
        WHERE quota_product_id = :qpId AND effective_date <= CURDATE() AND deleted_at IS NULL
        ORDER BY effective_date DESC
        LIMIT 1
    ");
    $stmtRate->execute([':qpId' => $quotaProductId]);
    $latestRate = $stmtRate->fetch();

    // If no product-specific rate, try global/scoped rate applicable to this product
    if (!$latestRate) {
        $stmtGlobal = $conn->prepare("
            SELECT qrs.* FROM quota_rate_schedules qrs
            WHERE qrs.quota_product_id IS NULL AND qrs.deleted_at IS NULL
            AND (
                NOT EXISTS (SELECT 1 FROM quota_rate_scope s WHERE s.rate_schedule_id = qrs.id)
                OR EXISTS (SELECT 1 FROM quota_rate_scope s WHERE s.rate_schedule_id = qrs.id AND s.quota_product_id = :qpId)
            )
            ORDER BY
                CASE WHEN qrs.quota_mode = 'confirm' THEN qrs.usage_start_date ELSE qrs.effective_date END DESC
            LIMIT 1
        ");
        $stmtGlobal->execute([':qpId' => $quotaProductId]);
        $latestRate = $stmtGlobal->fetch();
    }

    if (!$latestRate) {
        return [
            'autoQuota' => 0,
            'adminQuota' => 0,
            'totalQuota' => 0,
            'totalUsed' => 0,
            'remaining' => 0,
            'totalSales' => 0,
            'salesPerQuota' => 0,
            'quotaMode' => 'N/A',
            'periodStart' => null,
            'periodEnd' => null,
            'message' => 'No active rate schedule',
        ];
    }

    // 2. Get the quota product info
    $stmtQP = $conn->prepare("SELECT * FROM quota_products WHERE id = :qpId AND deleted_at IS NULL");
    $stmtQP->execute([':qpId' => $quotaProductId]);
    $qp = $stmtQP->fetch();
    if (!$qp) {
        return ['error' => 'Quota product not found'];
    }

    $quotaMode = $latestRate['quota_mode'];
    $orderDateField = $latestRate['order_date_field'];
    $dateCol = ($orderDateField === 'delivery_date') ? 'o.delivery_date' : 'o.order_date';
    $periodStart = null;
    $periodEnd = null;
    $totalSales = 0;
    $autoQuota = 0;
    $salesPerQuota = floatval($latestRate['sales_per_quota']);

    if ($quotaMode === 'reset') {
        // ====== RESET MODE ======
        $resetDayOfMonth = $latestRate['reset_day_of_month'] ? intval($latestRate['reset_day_of_month']) : null;

        if ($resetDayOfMonth) {
            // --- Monthly reset on specific day of month ---
            $now = new DateTime();
            $currentDay = intval($now->format('j'));
            $currentYear = intval($now->format('Y'));
            $currentMonth = intval($now->format('n'));

            if ($currentDay >= $resetDayOfMonth) {
                // We're past the reset day → period is this month's resetDay to next month's resetDay
                $periodStartDate = new DateTime("$currentYear-$currentMonth-$resetDayOfMonth");
                $nextMonth = (clone $periodStartDate)->modify('+1 month');
                $periodStart = $periodStartDate->format('Y-m-d');
                $periodEnd = $nextMonth->format('Y-m-d');
            } else {
                // We're before the reset day → period is last month's resetDay to this month's resetDay
                $periodEndDate = new DateTime("$currentYear-$currentMonth-$resetDayOfMonth");
                $lastMonth = (clone $periodEndDate)->modify('-1 month');
                $periodStart = $lastMonth->format('Y-m-d');
                $periodEnd = $periodEndDate->format('Y-m-d');
            }
        } else {
            // --- Interval-based reset (every N days from anchor) ---
            $intervalDays = intval($latestRate['reset_interval_days']);
            $anchorDate = $latestRate['reset_anchor_date'] ?: $latestRate['effective_date'];
            
            $anchor = new DateTime($anchorDate);
            $now = new DateTime();
            $daysSinceAnchor = intval($anchor->diff($now)->days);
            
            if ($now < $anchor) {
                $periodStart = $anchor->format('Y-m-d');
                $periodEnd = (clone $anchor)->modify("+{$intervalDays} days")->format('Y-m-d');
            } else {
                $periodsElapsed = floor($daysSinceAnchor / $intervalDays);
                $periodStartDate = (clone $anchor)->modify("+".($periodsElapsed * $intervalDays)." days");
                $periodEndDate = (clone $periodStartDate)->modify("+{$intervalDays} days");
                $periodStart = $periodStartDate->format('Y-m-d');
                $periodEnd = $periodEndDate->format('Y-m-d');
            }
        }

        // Calculate sales in this single period
        $totalSales = _calcSalesInPeriod($conn, $userId, $quotaProductId, $dateCol, $periodStart, $periodEnd);
        $autoQuota = ($salesPerQuota > 0) ? floor($totalSales / $salesPerQuota) : 0;

    } elseif ($quotaMode === 'cumulative') {
        // ====== CUMULATIVE MODE — Segmented Rate Calculation ======
        // Get ALL rates (oldest first) to build segments
        $stmtAll = $conn->prepare("
            SELECT * FROM quota_rate_schedules
            WHERE quota_product_id = :qpId AND effective_date <= CURDATE() AND deleted_at IS NULL
            ORDER BY effective_date ASC
        ");
        $stmtAll->execute([':qpId' => $quotaProductId]);
        $allRates = $stmtAll->fetchAll();

        // Find the earliest cumulative rate (stop at any 'reset' rate — it cuts off prior ones)
        $segments = [];
        foreach ($allRates as $r) {
            if ($r['quota_mode'] === 'reset') {
                // A reset rate cuts off all previous segments
                $segments = [];
            }
            $segments[] = $r;
        }

        // Build date-bounded segments
        $today = date('Y-m-d');
        $totalAutoQuota = 0;
        $grandTotalSales = 0;
        $overallStart = null;

        for ($i = 0; $i < count($segments); $i++) {
            $seg = $segments[$i];
            $segStart = $seg['effective_date'];
            $segEnd = isset($segments[$i + 1]) ? $segments[$i + 1]['effective_date'] : $today;
            $segSalesPerQuota = floatval($seg['sales_per_quota']);

            if ($overallStart === null) {
                $overallStart = $segStart;
            }

            // Calculate sales in this segment
            $segSales = _calcSalesInPeriod($conn, $userId, $quotaProductId, $dateCol, $segStart, $segEnd);
            $segQuota = ($segSalesPerQuota > 0) ? floor($segSales / $segSalesPerQuota) : 0;

            $totalAutoQuota += $segQuota;
            $grandTotalSales += $segSales;
        }

        $autoQuota = $totalAutoQuota;
        $totalSales = $grandTotalSales;
        $periodStart = $overallStart;
        $periodEnd = $today;
    } else {
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
            $totalSales = 0;
            $pendingAutoQuota = 0;
        }

        // Determine if require_confirm is on
        $requireConfirm = intval($latestRate['require_confirm'] ?? 1);

        if ($requireConfirm) {
            // FREEZE mode: check for confirmed allocation
            $stmtConf = $conn->prepare("
                SELECT COALESCE(SUM(quantity), 0) AS confirmed_total
                FROM quota_allocations
                WHERE quota_product_id = :qpId AND user_id = :uid AND source = 'auto_confirmed'
                AND source_detail = :rsId AND deleted_at IS NULL
            ");
            $stmtConf->execute([':qpId' => $quotaProductId, ':uid' => $userId, ':rsId' => (string)$latestRate['id']]);
            $confRow = $stmtConf->fetch();
            $confirmedQuota = floatval($confRow['confirmed_total']);
            $isConfirmed = $confirmedQuota > 0;
            $autoQuota = $confirmedQuota;
        } else {
            // NO-CONFIRM mode: use live calculation directly
            $isConfirmed = null; // not applicable
            $autoQuota = $pendingAutoQuota;
        }

        // Check expiry: if usage_end_date is a valid date and today > usage_end_date, quota is expired
        $usageEndDate = $latestRate['usage_end_date'] ?? null;
        $isExpired = false;
        if ($usageEndDate && strlen($usageEndDate) >= 10 && date('Y-m-d') > $usageEndDate) {
            $isExpired = true;
        }

        // Check if before usage start date
        $isBeforeUsageStart = false;
        if ($usageStartDate && date('Y-m-d') < $usageStartDate) {
            $autoQuota = 0;
            $isBeforeUsageStart = true;
        }
    }

    // 5. Get admin-added quota for this period
    $adminQuotaQuery = "
        SELECT COALESCE(SUM(quantity), 0) AS admin_total
        FROM quota_allocations
        WHERE quota_product_id = :qpId
        AND user_id = :userId
        AND source = 'admin' AND deleted_at IS NULL
    ";
    $adminParams = [':qpId' => $quotaProductId, ':userId' => $userId];
    
    if ($quotaMode === 'reset') {
        $adminQuotaQuery .= " AND period_start = :ps AND period_end = :pe";
        $adminParams[':ps'] = $periodStart;
        $adminParams[':pe'] = $periodEnd;
    }

    $stmtAdmin = $conn->prepare($adminQuotaQuery);
    $stmtAdmin->execute($adminParams);
    $adminRow = $stmtAdmin->fetch();
    $adminQuota = floatval($adminRow['admin_total']);

    // 6. Get total usage
    $usageQuery = "
        SELECT COALESCE(SUM(quantity_used), 0) AS total_used
        FROM quota_usage
        WHERE quota_product_id = :qpId
        AND user_id = :userId AND deleted_at IS NULL
    ";
    $usageParams = [':qpId' => $quotaProductId, ':userId' => $userId];

    if ($quotaMode === 'reset') {
        $usageQuery .= " AND period_start = :ps AND period_end = :pe";
        $usageParams[':ps'] = $periodStart;
        $usageParams[':pe'] = $periodEnd;
    }

    $stmtUsage = $conn->prepare($usageQuery);
    $stmtUsage->execute($usageParams);
    $usageRow = $stmtUsage->fetch();
    $totalUsed = floatval($usageRow['total_used']);

    // 7. Calculate remaining
    $totalQuota = $autoQuota + $adminQuota;
    $remaining = $totalQuota - $totalUsed;

    // 8. Global/Scoped quota — rates where quota_product_id IS NULL
    //    that either have no scope (global) or scope includes this product
    $globalAutoQuota = 0;
    $globalAdminQuota = 0;
    $globalUsed = 0;

    $stmtGlobalRate = $conn->prepare("
        SELECT qrs.* FROM quota_rate_schedules qrs
        WHERE qrs.quota_product_id IS NULL AND qrs.effective_date <= CURDATE() AND qrs.deleted_at IS NULL
        AND (
            NOT EXISTS (SELECT 1 FROM quota_rate_scope s WHERE s.rate_schedule_id = qrs.id)
            OR EXISTS (SELECT 1 FROM quota_rate_scope s WHERE s.rate_schedule_id = qrs.id AND s.quota_product_id = :qpId)
        )
        ORDER BY qrs.effective_date DESC
        LIMIT 1
    ");
    $stmtGlobalRate->execute([':qpId' => $quotaProductId]);
    $globalRate = $stmtGlobalRate->fetch();

    if ($globalRate) {
        $gSalesPerQuota = floatval($globalRate['sales_per_quota']);
        $gDateCol = ($globalRate['order_date_field'] === 'delivery_date') ? 'o.delivery_date' : 'o.order_date';
        $gMode = $globalRate['quota_mode'];

        // Calculate global auto quota (same sales, different rate)
        if ($gMode === 'confirm') {
            $gCalcStart = $globalRate['calc_period_start'];
            $gCalcEnd = $globalRate['calc_period_end'];
            $gUsageStart = $globalRate['usage_start_date'] ?? $globalRate['effective_date'];
            $gUsageEnd = $globalRate['usage_end_date'] ?? null;
            $gRequireConfirm = intval($globalRate['require_confirm'] ?? 1);

            // Check if before usage start or expired
            $gIsActive = true;
            if ($gUsageStart && date('Y-m-d') < $gUsageStart) $gIsActive = false;
            if ($gUsageEnd && date('Y-m-d') > $gUsageEnd) $gIsActive = false;

            if ($gIsActive && $gCalcStart && $gCalcEnd) {
                $gSales = _calcSalesInPeriod($conn, $userId, $quotaProductId, $gDateCol, $gCalcStart, $gCalcEnd);
                $gPending = ($gSalesPerQuota > 0) ? floor($gSales / $gSalesPerQuota) : 0;

                if ($gRequireConfirm) {
                    $stmtGConf = $conn->prepare("
                        SELECT COALESCE(SUM(quantity), 0) AS t FROM quota_allocations
                        WHERE quota_product_id IS NULL AND user_id = :uid AND source = 'auto_confirmed'
                        AND source_detail = :rsId AND deleted_at IS NULL
                    ");
                    $stmtGConf->execute([':uid' => $userId, ':rsId' => (string)$globalRate['id']]);
                    $globalAutoQuota = floatval($stmtGConf->fetch()['t']);
                } else {
                    $globalAutoQuota = $gPending;
                }
            }
        } else {
            // reset/cumulative for global — use period from product-specific
            if ($periodStart && $periodEnd && $gSalesPerQuota > 0) {
                $gSales = _calcSalesInPeriod($conn, $userId, $quotaProductId, $gDateCol, $periodStart, $periodEnd);
                $globalAutoQuota = floor($gSales / $gSalesPerQuota);
            }
        }

        // Global admin-added quota
        $stmtGAdmin = $conn->prepare("
            SELECT COALESCE(SUM(quantity), 0) AS t FROM quota_allocations
            WHERE quota_product_id IS NULL AND user_id = :uid AND source = 'admin' AND deleted_at IS NULL
        ");
        $stmtGAdmin->execute([':uid' => $userId]);
        $globalAdminQuota = floatval($stmtGAdmin->fetch()['t']);

        // Global usage
        $stmtGUsage = $conn->prepare("
            SELECT COALESCE(SUM(quantity_used), 0) AS t FROM quota_usage
            WHERE quota_product_id IS NULL AND user_id = :uid AND deleted_at IS NULL
        ");
        $stmtGUsage->execute([':uid' => $userId]);
        $globalUsed = floatval($stmtGUsage->fetch()['t']);
    }

    $globalRemaining = ($globalAutoQuota + $globalAdminQuota) - $globalUsed;
    $totalQuota += ($globalAutoQuota + $globalAdminQuota);
    $remaining = $totalQuota - $totalUsed - $globalUsed;

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
        'pendingAutoQuota' => $pendingAutoQuota ?? null,
        'isConfirmed' => $isConfirmed ?? null,
        'isExpired' => $isExpired ?? false,
        'usageEndDate' => $latestRate['usage_end_date'] ?? null,
        'requireConfirm' => isset($latestRate['require_confirm']) ? intval($latestRate['require_confirm']) : null,
        'isBeforeUsageStart' => $isBeforeUsageStart ?? false,
        'rateScheduleId' => $latestRate['id'] ?? null,
        'globalAutoQuota' => $globalAutoQuota,
        'globalAdminQuota' => $globalAdminQuota,
        'globalUsed' => $globalUsed,
        'globalRemaining' => $globalRemaining,
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

/** Helper: Calculate total sales using companyId directly (for global rates without quota_product_id) */
function _calcSalesInPeriodByCompany(PDO $conn, int $userId, int $companyId, string $dateCol, string $periodStart, string $periodEnd): float {
    $stmt = $conn->prepare("
        SELECT COALESCE(SUM(oi.quantity * oi.price_per_unit), 0) AS total_sales
        FROM order_items oi
        JOIN orders o ON o.id = oi.parent_order_id
        WHERE oi.creator_id = :userId
        AND o.company_id = :companyId
        AND o.order_status != 'Cancelled'
        AND $dateCol >= :periodStart
        AND $dateCol < :periodEnd
    ");
    $stmt->execute([
        ':userId' => $userId,
        ':companyId' => $companyId,
        ':periodStart' => $periodStart,
        ':periodEnd' => $periodEnd,
    ]);
    $row = $stmt->fetch();
    return floatval($row['total_sales']);
}

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
        AND role IN ('Telesale', 'Supervisor Telesale')
        ORDER BY first_name ASC
    ");
    $stmtUsers->execute([':companyId' => $companyId]);
    $users = $stmtUsers->fetchAll();

    if ($rateParam === 'all') {
        // ====== AGGREGATE MODE: sum across all active rates ======
        $stmtRates = $conn->prepare("
            SELECT * FROM quota_rate_schedules WHERE deleted_at IS NULL
            ORDER BY effective_date DESC
        ");
        $stmtRates->execute();
        $allRates = $stmtRates->fetchAll();

        // Filter to only rates that apply to this company
        $ratesForCompany = [];
        foreach ($allRates as $rate) {
            $rpid = $rate['quota_product_id'];
            if ($rpid) {
                // Product-specific rate — check company
                $chk = $conn->prepare("SELECT company_id FROM quota_products WHERE id = :id AND deleted_at IS NULL");
                $chk->execute([':id' => $rpid]);
                $qp = $chk->fetch();
                if ($qp && intval($qp['company_id']) === $companyId) {
                    $ratesForCompany[] = $rate;
                }
            } else {
                // Global rate — check scope products' company or assume global
                $ratesForCompany[] = $rate;
            }
        }

        // Dedupe: keep only the latest rate per unique (quotaProductId + quotaMode)
        // For global rates, group by id (each global rate is unique)
        $uniqueRates = [];
        $seen = [];
        foreach ($ratesForCompany as $rate) {
            $key = ($rate['quota_product_id'] ?: 'global') . '_' . $rate['quota_mode'] . '_' . $rate['id'];
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
 * Calculate quota for a specific user using a SPECIFIC rate schedule directly.
 * Unlike calculateQuota(), this doesn't search for rates — it uses the one provided.
 */
function calculateQuotaByRate(PDO $conn, array $rate, int $userId, int $companyId): array {
    $quotaMode = $rate['quota_mode'];
    $orderDateField = $rate['order_date_field'] ?? 'order_date';
    $dateCol = ($orderDateField === 'delivery_date') ? 'o.delivery_date' : 'o.order_date';
    $salesPerQuota = floatval($rate['sales_per_quota']);
    $quotaProductId = $rate['quota_product_id'] ? intval($rate['quota_product_id']) : 0;
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
        $calcStart = $rate['calc_period_start'] ?? null;
        $calcEnd = $rate['calc_period_end'] ?? null;
        $usageStartDate = $rate['usage_start_date'] ?? $rate['effective_date'];

        $periodStart = $calcStart;
        $periodEnd = $calcEnd;

        if ($calcStart && $calcEnd) {
            if ($quotaProductId) {
                $totalSales = _calcSalesInPeriod($conn, $userId, $quotaProductId, $dateCol, $calcStart, $calcEnd);
            } else {
                $totalSales = _calcSalesInPeriodByCompany($conn, $userId, $companyId, $dateCol, $calcStart, $calcEnd);
            }
            $pendingAutoQuota = ($salesPerQuota > 0) ? floor($totalSales / $salesPerQuota) : 0;
        } else {
            $pendingAutoQuota = 0;
        }

        $requireConfirm = intval($rate['require_confirm'] ?? 1);

        if ($requireConfirm) {
            // Check for confirmed allocation
            $allocWhere = $quotaProductId
                ? "quota_product_id = :qpId"
                : "quota_product_id IS NULL";
            $stmtConf = $conn->prepare("
                SELECT COALESCE(SUM(quantity), 0) AS confirmed_total
                FROM quota_allocations
                WHERE $allocWhere AND user_id = :uid AND source = 'auto_confirmed'
                AND source_detail = :rsId AND deleted_at IS NULL
            ");
            $params = [':uid' => $userId, ':rsId' => (string)$rate['id']];
            if ($quotaProductId) $params[':qpId'] = $quotaProductId;
            $stmtConf->execute($params);
            $confRow = $stmtConf->fetch();
            $confirmedQuota = floatval($confRow['confirmed_total']);
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

        // Check before usage start
        if ($usageStartDate && date('Y-m-d') < $usageStartDate) {
            $autoQuota = 0;
            $isBeforeUsageStart = true;
        }

    } elseif ($quotaMode === 'reset') {
        // ====== RESET MODE ======
        $resetDayOfMonth = $rate['reset_day_of_month'] ? intval($rate['reset_day_of_month']) : null;

        if ($resetDayOfMonth) {
            $now = new DateTime();
            $currentDay = intval($now->format('j'));
            $currentYear = intval($now->format('Y'));
            $currentMonth = intval($now->format('n'));

            if ($currentDay >= $resetDayOfMonth) {
                $periodStartDate = new DateTime("$currentYear-$currentMonth-$resetDayOfMonth");
                $nextMonth = (clone $periodStartDate)->modify('+1 month');
                $periodStart = $periodStartDate->format('Y-m-d');
                $periodEnd = $nextMonth->format('Y-m-d');
            } else {
                $periodEndDate = new DateTime("$currentYear-$currentMonth-$resetDayOfMonth");
                $lastMonth = (clone $periodEndDate)->modify('-1 month');
                $periodStart = $lastMonth->format('Y-m-d');
                $periodEnd = $periodEndDate->format('Y-m-d');
            }
        } else {
            $intervalDays = intval($rate['reset_interval_days']);
            $anchorDate = $rate['reset_anchor_date'] ?: $rate['effective_date'];
            $anchor = new DateTime($anchorDate);
            $now = new DateTime();
            $daysSinceAnchor = intval($anchor->diff($now)->days);

            if ($now < $anchor) {
                $periodStart = $anchor->format('Y-m-d');
                $periodEnd = (clone $anchor)->modify("+{$intervalDays} days")->format('Y-m-d');
            } else {
                $periodsElapsed = floor($daysSinceAnchor / $intervalDays);
                $periodStartDate = (clone $anchor)->modify("+".($periodsElapsed * $intervalDays)." days");
                $periodEndDate = (clone $periodStartDate)->modify("+{$intervalDays} days");
                $periodStart = $periodStartDate->format('Y-m-d');
                $periodEnd = $periodEndDate->format('Y-m-d');
            }
        }

        if ($quotaProductId) {
            $totalSales = _calcSalesInPeriod($conn, $userId, $quotaProductId, $dateCol, $periodStart, $periodEnd);
        } else {
            $totalSales = _calcSalesInPeriodByCompany($conn, $userId, $companyId, $dateCol, $periodStart, $periodEnd);
        }
        $autoQuota = ($salesPerQuota > 0) ? floor($totalSales / $salesPerQuota) : 0;

    } elseif ($quotaMode === 'cumulative') {
        // ====== CUMULATIVE MODE ======
        $periodStart = $rate['effective_date'];
        $periodEnd = date('Y-m-d');

        if ($quotaProductId) {
            $totalSales = _calcSalesInPeriod($conn, $userId, $quotaProductId, $dateCol, $periodStart, $periodEnd);
        } else {
            $totalSales = _calcSalesInPeriodByCompany($conn, $userId, $companyId, $dateCol, $periodStart, $periodEnd);
        }
        $autoQuota = ($salesPerQuota > 0) ? floor($totalSales / $salesPerQuota) : 0;
    }

    // Admin-added quota
    $allocWhere2 = $quotaProductId
        ? "quota_product_id = :qpId"
        : "quota_product_id IS NULL";
    $adminQuery = "
        SELECT COALESCE(SUM(quantity), 0) AS admin_total
        FROM quota_allocations
        WHERE $allocWhere2 AND user_id = :userId AND source = 'admin' AND deleted_at IS NULL
    ";
    $adminParams = [':userId' => $userId];
    if ($quotaProductId) $adminParams[':qpId'] = $quotaProductId;
    if ($quotaMode === 'reset') {
        $adminQuery .= " AND period_start = :ps AND period_end = :pe";
        $adminParams[':ps'] = $periodStart;
        $adminParams[':pe'] = $periodEnd;
    }
    $stmtAdmin = $conn->prepare($adminQuery);
    $stmtAdmin->execute($adminParams);
    $adminQuota = floatval($stmtAdmin->fetch()['admin_total']);

    // Usage
    $usageWhere = $quotaProductId
        ? "quota_product_id = :qpId"
        : "quota_product_id IS NULL";
    $usageQuery = "
        SELECT COALESCE(SUM(quantity_used), 0) AS total_used
        FROM quota_usage
        WHERE $usageWhere AND user_id = :userId AND deleted_at IS NULL
    ";
    $usageParams = [':userId' => $userId];
    if ($quotaProductId) $usageParams[':qpId'] = $quotaProductId;
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
    $salesPerQuota = floatval($rate['sales_per_quota']);
    $quotaProductId = $rate['quota_product_id'] ? intval($rate['quota_product_id']) : 0;

    if (!$calcStart || !$calcEnd || $salesPerQuota <= 0) {
        json_response(['error' => 'Rate schedule missing calc_period or salesPerQuota'], 400);
    }

    $results = [];
    foreach ($userIds as $uid) {
        $uid = intval($uid);
        if (!$uid) continue;

        // Calculate sales
        if ($quotaProductId) {
            $totalSales = _calcSalesInPeriod($conn, $uid, $quotaProductId, $dateCol, $calcStart, $calcEnd);
        } else {
            $totalSales = _calcSalesInPeriodByCompany($conn, $uid, $companyId, $dateCol, $calcStart, $calcEnd);
        }
        $autoQuota = floor($totalSales / $salesPerQuota);

        // Delete existing auto_confirmed for this rate+user
        $delWhere = $quotaProductId ? "quota_product_id = :qpId" : "quota_product_id IS NULL";
        $delSql = "UPDATE quota_allocations SET deleted_at = NOW()
            WHERE $delWhere AND user_id = :uid AND source = 'auto_confirmed' AND source_detail = :rsId AND deleted_at IS NULL";
        $delParams = [':uid' => $uid, ':rsId' => (string)$rateScheduleId];
        if ($quotaProductId) $delParams[':qpId'] = $quotaProductId;
        $conn->prepare($delSql)->execute($delParams);

        // Insert confirmed allocation
        $conn->prepare("
            INSERT INTO quota_allocations (quota_product_id, user_id, company_id, quantity, source, source_detail, allocated_by, period_start, period_end)
            VALUES (:qpId, :uid, :cid, :qty, 'auto_confirmed', :rsId, :ab, :ps, :pe)
        ")->execute([
            ':qpId' => $quotaProductId ?: null,
            ':uid' => $uid,
            ':cid' => $companyId,
            ':qty' => $autoQuota,
            ':rsId' => (string)$rateScheduleId,
            ':ab' => $confirmedBy,
            ':ps' => $calcStart,
            ':pe' => $calcEnd,
        ]);

        $results[] = ['userId' => $uid, 'confirmedQuota' => $autoQuota, 'totalSales' => $totalSales];
    }

    json_response([
        'success' => true,
        'confirmed' => count($results),
        'results' => $results,
    ]);
}

