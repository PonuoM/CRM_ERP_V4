<?php
/**
 * Sales Sheet API — Google Sheet-style item-level sales data
 * GET: Fetch paginated order items with joined order/customer/product/user data
 * 
 * Params: company_id, month, year, seller_id, order_status, customer_type, search, page, pageSize
 */

require_once __DIR__ . '/../config.php';

cors();

try {
    $pdo = db_connect();
    $user = get_authenticated_user($pdo);

    if (!$user) {
        json_response(['success' => false, 'message' => 'Unauthorized'], 401);
        exit;
    }

    $companyId = $user['company_id'];
    $currentUserId = $user['id'];
    $currentUserRole = strtolower($user['role'] ?? '');

    // Role checks
    $isSupervisor = strpos($currentUserRole, 'supervisor') !== false;
    $isAdmin = (strpos($currentUserRole, 'admin') !== false && !$isSupervisor)
        || $currentUserRole === 'super admin'
        || (strpos($currentUserRole, 'super') !== false && !$isSupervisor);
    $isCEO = strpos($currentUserRole, 'ceo') !== false || $currentUserRole === 'ceo';

    // Parameters
    $month = isset($_GET['month']) ? intval($_GET['month']) : intval(date('m'));
    $year = isset($_GET['year']) ? intval($_GET['year']) : intval(date('Y'));
    $sellerId = isset($_GET['seller_id']) ? intval($_GET['seller_id']) : 0;
    $orderStatus = isset($_GET['order_status']) ? trim($_GET['order_status']) : '';
    $customerType = isset($_GET['customer_type']) ? trim($_GET['customer_type']) : '';
    $search = isset($_GET['search']) ? trim($_GET['search']) : '';
    $page = isset($_GET['page']) ? max(1, intval($_GET['page'])) : 1;
    $pageSize = isset($_GET['pageSize']) ? min(10000, max(10, intval($_GET['pageSize']))) : 200;

    // Date range: inclusive start, exclusive end
    $startDate = sprintf('%04d-%02d-01 00:00:00', $year, $month);
    $endDate = date('Y-m-d 00:00:00', strtotime($startDate . ' +1 month'));

    // Build access filter (role-based scoping)
    // Use oi.creator_id so upsell sellers see their own items even on other sellers' orders
    $accessFilter = "";
    $accessParams = [];

    if (!$isAdmin && !$isCEO) {
        if ($isSupervisor) {
            // Supervisor sees self + team (items created by them)
            $teamStmt = $pdo->prepare("SELECT id FROM users WHERE (id = ? OR supervisor_id = ?) AND status = 'active'");
            $teamStmt->execute([$currentUserId, $currentUserId]);
            $teamIds = $teamStmt->fetchAll(PDO::FETCH_COLUMN);
            if (!empty($teamIds)) {
                $placeholders = implode(',', array_fill(0, count($teamIds), '?'));
                $accessFilter = " AND COALESCE(oi.creator_id, o.creator_id) IN ($placeholders)";
                $accessParams = $teamIds;
            } else {
                $accessFilter = " AND COALESCE(oi.creator_id, o.creator_id) = ?";
                $accessParams = [$currentUserId];
            }
        } else {
            // Telesale sees only items they created (supports upsell)
            $accessFilter = " AND COALESCE(oi.creator_id, o.creator_id) = ?";
            $accessParams = [$currentUserId];
        }
    }

    // Build optional filters
    $extraFilter = "";
    $extraParams = [];

    if ($sellerId > 0) {
        $extraFilter .= " AND COALESCE(oi.creator_id, o.creator_id) = ?";
        $extraParams[] = $sellerId;
    }

    if ($orderStatus !== '') {
        $extraFilter .= " AND o.order_status = ?";
        $extraParams[] = $orderStatus;
    }

    if ($customerType !== '') {
        $extraFilter .= " AND o.customer_type = ?";
        $extraParams[] = $customerType;
    }

    if ($search !== '') {
        $extraFilter .= " AND (
            o.id LIKE ? 
            OR CONCAT(COALESCE(c.first_name,''), ' ', COALESCE(c.last_name,'')) LIKE ?
            OR c.phone LIKE ?
            OR oi.product_name LIKE ?
        )";
        $searchWild = "%$search%";
        $extraParams = array_merge($extraParams, [$searchWild, $searchWild, $searchWild, $searchWild]);
    }

    // Common WHERE
    $whereClause = "
        WHERE o.company_id = ?
        AND o.order_date >= ? AND o.order_date < ?
        $accessFilter
        $extraFilter
    ";
    $baseParams = array_merge([$companyId, $startDate, $endDate], $accessParams, $extraParams);

    // Count total rows
    $countSql = "
        SELECT COUNT(*) AS total
        FROM order_items oi
        JOIN orders o ON oi.parent_order_id = o.id
        LEFT JOIN customers c ON o.customer_id = c.customer_id
        $whereClause
    ";
    $countStmt = $pdo->prepare($countSql);
    $countStmt->execute($baseParams);
    $totalRows = intval($countStmt->fetchColumn());

    // Summary
    $summarySql = "
        SELECT 
            COUNT(DISTINCT o.id) AS total_orders,
            COUNT(oi.id) AS total_items,
            COALESCE(SUM(
                CASE WHEN (oi.is_freebie = 0 OR oi.is_freebie IS NULL)
                     THEN COALESCE(oi.net_total, oi.quantity * oi.price_per_unit)
                     ELSE 0 END
            ), 0) AS total_revenue
        FROM order_items oi
        JOIN orders o ON oi.parent_order_id = o.id
        LEFT JOIN customers c ON o.customer_id = c.customer_id
        $whereClause
    ";
    $summaryStmt = $pdo->prepare($summarySql);
    $summaryStmt->execute($baseParams);
    $summary = $summaryStmt->fetch(PDO::FETCH_ASSOC);

    // Data rows
    $offset = ($page - 1) * $pageSize;
    $dataSql = "
        SELECT 
            o.order_date,
            o.id AS order_number,
            o.customer_type,
            oi.basket_key_at_sale,
            COALESCE(bc.basket_name, oi.basket_key_at_sale) AS basket_name,
            o.sales_channel,
            o.payment_method,
            CONCAT(COALESCE(c.first_name,''), ' ', COALESCE(c.last_name,'')) AS customer_name,
            c.phone AS customer_phone,
            CONCAT_WS(', ',
                NULLIF(o.street, ''),
                NULLIF(o.subdistrict, ''),
                NULLIF(o.district, ''),
                NULLIF(o.province, ''),
                NULLIF(o.postal_code, '')
            ) AS address,
            o.province,
            p.sku AS product_sku,
            oi.product_name,
            oi.quantity,
            CASE WHEN (oi.is_freebie = 1) THEN 0
                 ELSE COALESCE(oi.net_total, oi.quantity * oi.price_per_unit) END AS net_total,
            oi.price_per_unit,
            oi.is_freebie,
            o.delivery_date,
            o.order_status,
            o.payment_status,
            CONCAT(COALESCE(u_item.first_name, u_order.first_name,''), ' ', COALESCE(u_item.last_name, u_order.last_name,'')) AS seller_name,
            COALESCE(oi.creator_id, o.creator_id) AS seller_id,
            o.id AS order_id
        FROM order_items oi
        JOIN orders o ON oi.parent_order_id = o.id
        LEFT JOIN customers c ON o.customer_id = c.customer_id
        LEFT JOIN products p ON oi.product_id = p.id
        LEFT JOIN users u_item ON oi.creator_id = u_item.id
        LEFT JOIN users u_order ON o.creator_id = u_order.id
        LEFT JOIN basket_config bc ON oi.basket_key_at_sale = bc.basket_key AND bc.company_id = 1
        $whereClause
        ORDER BY o.order_date ASC, o.id ASC, oi.id ASC
        LIMIT ? OFFSET ?
    ";
    $allParams = array_merge($baseParams, [$pageSize, $offset]);
    $dataStmt = $pdo->prepare($dataSql);
    $dataStmt->execute($allParams);
    $rows = $dataStmt->fetchAll(PDO::FETCH_ASSOC);

    // Fetch sellers list for filter dropdown
    $sellersSql = "
        SELECT DISTINCT u.id, CONCAT(COALESCE(u.first_name,''), ' ', COALESCE(u.last_name,'')) AS name
        FROM users u
        WHERE u.company_id = ? AND u.status = 'active'
        AND u.role LIKE '%telesale%' OR u.role LIKE '%supervisor%' OR u.role LIKE '%admin%'
        ORDER BY u.first_name
    ";
    $sellersStmt = $pdo->prepare($sellersSql);
    $sellersStmt->execute([$companyId]);
    $sellers = $sellersStmt->fetchAll(PDO::FETCH_ASSOC);

    json_response([
        'success' => true,
        'rows' => $rows,
        'summary' => [
            'total_orders' => intval($summary['total_orders']),
            'total_items' => intval($summary['total_items']),
            'total_revenue' => floatval($summary['total_revenue']),
        ],
        'sellers' => $sellers,
        'pagination' => [
            'page' => $page,
            'pageSize' => $pageSize,
            'total' => $totalRows,
            'totalPages' => ceil($totalRows / $pageSize),
        ],
        'filters' => [
            'month' => $month,
            'year' => $year,
        ],
    ]);

} catch (Exception $e) {
    error_log("Sales Sheet API Error: " . $e->getMessage());
    json_response(['success' => false, 'message' => 'Server error: ' . $e->getMessage()], 500);
}
