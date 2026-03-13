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
        WHERE qp.company_id = :companyId
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

    // Get currently active rate (effective_date <= NOW, latest)
    $stmt = $conn->prepare("
        SELECT * FROM quota_rate_schedules
        WHERE quota_product_id = :qpId AND effective_date <= CURDATE()
        ORDER BY effective_date DESC
        LIMIT 1
    ");
    $stmt->execute([':qpId' => $quotaProductId]);
    $rate = $stmt->fetch();

    json_response(['success' => true, 'data' => $rate ?: null]);
}

function handleListRates(PDO $conn) {
    $quotaProductId = intval($_GET['quotaProductId'] ?? 0);
    if (!$quotaProductId) {
        json_response(['error' => 'quotaProductId required'], 400);
    }

    $stmt = $conn->prepare("
        SELECT qrs.*, u.first_name AS created_by_name
        FROM quota_rate_schedules qrs
        LEFT JOIN users u ON u.id = qrs.created_by
        WHERE qrs.quota_product_id = :qpId
        ORDER BY qrs.effective_date DESC
    ");
    $stmt->execute([':qpId' => $quotaProductId]);
    $rates = $stmt->fetchAll();

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

    $stmt = $conn->prepare("
        INSERT INTO quota_products (product_id, company_id, display_name, csv_label, quota_cost)
        VALUES (:productId, :companyId, :displayName, :csvLabel, :quotaCost)
        ON DUPLICATE KEY UPDATE display_name = VALUES(display_name), csv_label = VALUES(csv_label), quota_cost = VALUES(quota_cost), is_active = 1
    ");
    $stmt->execute([
        ':productId' => $productId,
        ':companyId' => $companyId,
        ':displayName' => $displayName,
        ':csvLabel' => $csvLabel,
        ':quotaCost' => $quotaCost,
    ]);

    $id = $conn->lastInsertId() ?: null;
    // If ON DUPLICATE KEY UPDATE fired, get the existing ID
    if (!$id) {
        $stmt2 = $conn->prepare("SELECT id FROM quota_products WHERE product_id = :pid AND company_id = :cid");
        $stmt2->execute([':pid' => $productId, ':cid' => $companyId]);
        $row = $stmt2->fetch();
        $id = $row['id'] ?? null;
    }

    json_response(['success' => true, 'id' => $id]);
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

    if (!$quotaProductId || $salesPerQuota <= 0 || !$effectiveDate) {
        json_response(['error' => 'quotaProductId, salesPerQuota (>0), effectiveDate required'], 400);
    }

    if (!in_array($orderDateField, ['order_date', 'delivery_date'])) {
        $orderDateField = 'order_date';
    }
    if (!in_array($quotaMode, ['reset', 'cumulative'])) {
        $quotaMode = 'reset';
    }
    // Validate day of month (1-28)
    if ($resetDayOfMonth !== null && ($resetDayOfMonth < 1 || $resetDayOfMonth > 28)) {
        $resetDayOfMonth = null;
    }

    $stmt = $conn->prepare("
        INSERT INTO quota_rate_schedules 
            (quota_product_id, sales_per_quota, effective_date, order_date_field, quota_mode, reset_interval_days, reset_day_of_month, reset_anchor_date, created_by)
        VALUES 
            (:qpId, :sPerQ, :effDate, :odf, :qm, :rid, :rdom, :rad, :cb)
    ");
    $stmt->execute([
        ':qpId' => $quotaProductId,
        ':sPerQ' => $salesPerQuota,
        ':effDate' => $effectiveDate,
        ':odf' => $orderDateField,
        ':qm' => $quotaMode,
        ':rid' => $resetIntervalDays,
        ':rdom' => $resetDayOfMonth,
        ':rad' => $resetAnchorDate,
        ':cb' => $createdBy,
    ]);

    json_response(['success' => true, 'id' => $conn->lastInsertId()]);
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
        $qm = in_array($data['quotaMode'], ['reset', 'cumulative']) ? $data['quotaMode'] : 'reset';
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

    $conn->prepare("DELETE FROM quota_rate_schedules WHERE id = :id")->execute([':id' => $id]);
    json_response(['success' => true]);
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
        WHERE quota_product_id = :qpId AND effective_date <= CURDATE()
        ORDER BY effective_date DESC
        LIMIT 1
    ");
    $stmtRate->execute([':qpId' => $quotaProductId]);
    $latestRate = $stmtRate->fetch();

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
    $stmtQP = $conn->prepare("SELECT * FROM quota_products WHERE id = :qpId");
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

    } else {
        // ====== CUMULATIVE MODE — Segmented Rate Calculation ======
        // Get ALL rates (oldest first) to build segments
        $stmtAll = $conn->prepare("
            SELECT * FROM quota_rate_schedules
            WHERE quota_product_id = :qpId AND effective_date <= CURDATE()
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
    }

    // 5. Get admin-added quota for this period
    $adminQuotaQuery = "
        SELECT COALESCE(SUM(quantity), 0) AS admin_total
        FROM quota_allocations
        WHERE quota_product_id = :qpId
        AND user_id = :userId
        AND source = 'admin'
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
        AND user_id = :userId
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
        AND o.company_id = (SELECT company_id FROM quota_products WHERE id = :qpId)
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
