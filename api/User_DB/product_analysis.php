<?php
/**
 * Product Analysis API
 * 
 * Returns product sales analytics data including:
 * - Top 5 products by revenue
 * - Top 5 products by quantity
 * - Sales breakdown by product category
 * - Monthly sales pivot table
 * 
 * Params:
 * - year (required): Year to filter
 * - month (optional): Month to filter (0 = all months)
 * - user_id (optional): Filter by specific employee
 * - company_id (required): Company ID
 */

ini_set('display_errors', 1);
error_reporting(E_ALL);

require_once __DIR__ . '/../config.php';

cors();

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

try {
    $pdo = db_connect();
    
    // Get authenticated user for role-based access control
    $authUser = get_authenticated_user($pdo);
    if (!$authUser) {
        json_response(['ok' => false, 'error' => 'Unauthorized'], 401);
    }
    
    // Get parameters
    $year = isset($_GET['year']) ? (int)$_GET['year'] : (int)date('Y');
    $month = isset($_GET['month']) ? (int)$_GET['month'] : 0; // 0 = all months
    $userId = isset($_GET['user_id']) ? (int)$_GET['user_id'] : 0;
    $companyId = isset($_GET['company_id']) ? (int)$_GET['company_id'] : ($authUser['company_id'] ?? null);
    
    if (!$companyId) {
        json_response(['ok' => false, 'error' => 'company_id is required'], 400);
    }
    
    // Role-based access control
    $currentUserRole = strtolower($authUser['role'] ?? '');
    $currentUserId = (int)($authUser['id'] ?? 0);
    $isSupervisor = strpos($currentUserRole, 'supervisor') !== false;
    // Check for admin roles - must exclude 'supervisor' which contains 'super'
    $isAdmin = (strpos($currentUserRole, 'admin') !== false) || 
               ($currentUserRole === 'super admin') ||
               (strpos($currentUserRole, 'super') !== false && !$isSupervisor);
    
    // Build employee filter based on role
    $employeeFilter = '';
    $employeeParams = [];
    
    if ($userId > 0) {
        // Specific user requested - check permissions
        if (!$isAdmin && !$isSupervisor && $userId != $currentUserId) {
            json_response(['ok' => false, 'error' => 'Access denied to view other users data'], 403);
        }
        $employeeFilter = ' AND o.creator_id = ?';
        $employeeParams[] = $userId;
    } elseif (!$isAdmin && !$isSupervisor) {
        // Regular Telesale can only see their own data
        $employeeFilter = ' AND o.creator_id = ?';
        $employeeParams[] = $currentUserId;
    } elseif ($isSupervisor && !$isAdmin) {
        // Supervisor can see self + team members (users where supervisor_id = current user)
        $teamStmt = $pdo->prepare("
            SELECT id FROM users 
            WHERE (id = :uid1 OR supervisor_id = :uid2) 
              AND company_id = :cid 
              AND status = 'active'
        ");
        $teamStmt->execute([
            ':uid1' => $currentUserId,
            ':uid2' => $currentUserId,
            ':cid' => $companyId
        ]);
        $teamUserIds = $teamStmt->fetchAll(PDO::FETCH_COLUMN);
        
        if (!empty($teamUserIds)) {
            $placeholders = implode(',', array_fill(0, count($teamUserIds), '?'));
            $employeeFilter = " AND o.creator_id IN ($placeholders)";
            $employeeParams = $teamUserIds;
        } else {
            // No team members found, show only self
            $employeeFilter = ' AND o.creator_id = ?';
            $employeeParams[] = $currentUserId;
        }
    }
    // Admin can see all data without employee filter
    
    // Date filter
    $dateFilter = ' AND YEAR(o.order_date) = ?';
    $dateParams = [$year];
    if ($month > 0) {
        $dateFilter .= ' AND MONTH(o.order_date) = ?';
        $dateParams[] = $month;
    }
    
    // Status filter - exclude cancelled orders
    $statusFilter = " AND o.order_status NOT IN ('Cancelled', 'Returned', 'BadDebt')";
    
    // ========================================
    // Query 1: Top 5 Products by Revenue
    // ========================================
    $sqlTopByValue = "
        SELECT 
            p.id,
            p.name,
            p.sku,
            p.category,
            SUM(oi.quantity * oi.price_per_unit) as total_value,
            SUM(oi.quantity) as total_quantity
        FROM order_items oi
        JOIN orders o ON oi.parent_order_id = o.id
        JOIN products p ON oi.product_id = p.id
        WHERE o.company_id = ?
        $dateFilter
        $statusFilter
        $employeeFilter
        AND (oi.is_freebie = 0 OR oi.is_freebie IS NULL)
        GROUP BY p.id, p.name, p.sku, p.category
        ORDER BY total_value DESC
        LIMIT 5
    ";
    
    $params = array_merge([$companyId], $dateParams, $employeeParams);
    $stmt = $pdo->prepare($sqlTopByValue);
    $stmt->execute($params);
    $topProductsByValue = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // ========================================
    // Query 2: Top 5 Products by Quantity
    // ========================================
    $sqlTopByQty = "
        SELECT 
            p.id,
            p.name,
            p.sku,
            p.category,
            SUM(oi.quantity) as total_quantity,
            SUM(oi.quantity * oi.price_per_unit) as total_value
        FROM order_items oi
        JOIN orders o ON oi.parent_order_id = o.id
        JOIN products p ON oi.product_id = p.id
        WHERE o.company_id = ?
        $dateFilter
        $statusFilter
        $employeeFilter
        AND (oi.is_freebie = 0 OR oi.is_freebie IS NULL)
        GROUP BY p.id, p.name, p.sku, p.category
        ORDER BY total_quantity DESC
        LIMIT 5
    ";
    
    $stmt = $pdo->prepare($sqlTopByQty);
    $stmt->execute($params);
    $topProductsByQuantity = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // ========================================
    // Query 3: Sales by Category and Customer Type
    // ========================================
    $sqlCategorySales = "
        SELECT 
            CASE 
                WHEN p.report_category IN ('กระสอบใหญ่', 'กระสอบเล็ก', 'ชีวภัณฑ์') THEN p.report_category
                ELSE 'อื่นๆ'
            END as category_group,
            COALESCE(o.customer_type, 'ไม่ระบุ') as customer_type,
            SUM(oi.quantity * oi.price_per_unit) as revenue,
            SUM(oi.quantity) as quantity,
            COUNT(DISTINCT o.id) as order_count
        FROM order_items oi
        JOIN orders o ON oi.parent_order_id = o.id
        JOIN products p ON oi.product_id = p.id
        WHERE o.company_id = ?
        $dateFilter
        $statusFilter
        $employeeFilter
        AND (oi.is_freebie = 0 OR oi.is_freebie IS NULL)
        GROUP BY category_group, customer_type
        ORDER BY category_group, customer_type
    ";
    
    $stmt = $pdo->prepare($sqlCategorySales);
    $stmt->execute($params);
    $salesByCategory = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // ========================================
    // Query 4: Monthly Sales Breakdown 
    // ========================================
    $sqlMonthlySales = "
        SELECT 
            p.id as product_id,
            p.name as product_name,
            p.sku,
            p.category,
            MONTH(o.order_date) as month,
            SUM(oi.quantity) as quantity,
            SUM(oi.quantity * oi.price_per_unit) as revenue
        FROM order_items oi
        JOIN orders o ON oi.parent_order_id = o.id
        JOIN products p ON oi.product_id = p.id
        WHERE o.company_id = ?
        AND YEAR(o.order_date) = ?
        $statusFilter
        $employeeFilter
        AND (oi.is_freebie = 0 OR oi.is_freebie IS NULL)
        GROUP BY p.id, p.name, p.sku, p.category, MONTH(o.order_date)
        ORDER BY p.name, month
    ";
    
    $monthlyParams = array_merge([$companyId, $year], $employeeParams);
    $stmt = $pdo->prepare($sqlMonthlySales);
    $stmt->execute($monthlyParams);
    $monthlySalesRaw = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Transform to pivot format
    $monthlyPivot = [];
    foreach ($monthlySalesRaw as $row) {
        $key = $row['product_id'];
        if (!isset($monthlyPivot[$key])) {
            $monthlyPivot[$key] = [
                'product_id' => $row['product_id'],
                'product_name' => $row['product_name'],
                'sku' => $row['sku'],
                'category' => $row['category'],
                'months' => array_fill(1, 12, ['quantity' => 0, 'revenue' => 0]),
                'total_quantity' => 0,
                'total_revenue' => 0
            ];
        }
        $m = (int)$row['month'];
        $monthlyPivot[$key]['months'][$m] = [
            'quantity' => (int)$row['quantity'],
            'revenue' => (float)$row['revenue']
        ];
        $monthlyPivot[$key]['total_quantity'] += (int)$row['quantity'];
        $monthlyPivot[$key]['total_revenue'] += (float)$row['revenue'];
    }
    
    // Sort by total revenue descending
    usort($monthlyPivot, function($a, $b) {
        return $b['total_revenue'] <=> $a['total_revenue'];
    });
    
    // ========================================
    // Query 5: Employee list for filter dropdown (Role-based)
    // ========================================
    if ($isAdmin) {
        // Admin can see all employees
        $sqlEmployees = "
            SELECT id, first_name, last_name, role
            FROM users
            WHERE company_id = ?
            AND (LOWER(role) = 'telesale' OR LOWER(role) LIKE '%supervisor%' OR LOWER(role) LIKE '%admin%')
            AND status = 'active'
            ORDER BY first_name, last_name
        ";
        $stmt = $pdo->prepare($sqlEmployees);
        $stmt->execute([$companyId]);
    } elseif ($isSupervisor) {
        // Supervisor sees self + team members where supervisor_id = current user
        $sqlEmployees = "
            SELECT id, first_name, last_name, role
            FROM users
            WHERE (id = :uid1 OR supervisor_id = :uid2)
            AND company_id = :cid
            AND status = 'active'
            ORDER BY 
                CASE WHEN id = :uid3 THEN 0 ELSE 1 END,
                first_name, last_name
        ";
        $stmt = $pdo->prepare($sqlEmployees);
        $stmt->execute([
            ':uid1' => $currentUserId,
            ':uid2' => $currentUserId,
            ':uid3' => $currentUserId,
            ':cid' => $companyId
        ]);
    } else {
        // Telesale sees only self
        $sqlEmployees = "
            SELECT id, first_name, last_name, role
            FROM users
            WHERE id = ?
            AND company_id = ?
        ";
        $stmt = $pdo->prepare($sqlEmployees);
        $stmt->execute([$currentUserId, $companyId]);
    }
    $employees = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // ========================================
    // Query 6: "Others" category detail (for expansion)
    // ========================================
    $sqlOthersDetail = "
        SELECT 
            p.id,
            p.name,
            p.sku,
            p.category,
            o.customer_type,
            SUM(oi.quantity * oi.price_per_unit) as revenue,
            SUM(oi.quantity) as quantity
        FROM order_items oi
        JOIN orders o ON oi.parent_order_id = o.id
        JOIN products p ON oi.product_id = p.id
        WHERE o.company_id = ?
        $dateFilter
        $statusFilter
        $employeeFilter
        AND (oi.is_freebie = 0 OR oi.is_freebie IS NULL)
        AND p.category NOT IN ('กระสอบใหญ่', 'กระสอบเล็ก', 'ชีวภัณฑ์')
        GROUP BY p.id, p.name, p.sku, p.category, o.customer_type
        ORDER BY revenue DESC
    ";
    
    $stmt = $pdo->prepare($sqlOthersDetail);
    $stmt->execute($params);
    $othersDetail = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // ========================================
    // Query 7: Freebie Breakdown by report_category
    // ========================================
    $sqlFreebieBreakdown = "
        SELECT 
            COALESCE(p.report_category, p.category, 'ไม่ระบุ') as category_group,
            COALESCE(o.customer_type, 'ไม่ระบุ') as customer_type,
            SUM(oi.quantity) as quantity,
            COUNT(DISTINCT o.id) as order_count
        FROM order_items oi
        JOIN orders o ON oi.parent_order_id = o.id
        JOIN products p ON oi.product_id = p.id
        WHERE o.company_id = ?
        $dateFilter
        $statusFilter
        $employeeFilter
        AND oi.is_freebie = 1
        GROUP BY category_group, customer_type
        ORDER BY category_group, customer_type
    ";
    
    $stmt = $pdo->prepare($sqlFreebieBreakdown);
    $stmt->execute($params);
    $freebieByCategory = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // ========================================
    // Query 8: Freebie Summary
    // ========================================
    $sqlFreebieSummary = "
        SELECT 
            SUM(oi.quantity) as total_quantity,
            COUNT(DISTINCT o.id) as total_orders
        FROM order_items oi
        JOIN orders o ON oi.parent_order_id = o.id
        WHERE o.company_id = ?
        $dateFilter
        $statusFilter
        $employeeFilter
        AND oi.is_freebie = 1
    ";
    
    $stmt = $pdo->prepare($sqlFreebieSummary);
    $stmt->execute($params);
    $freebieSummary = $stmt->fetch(PDO::FETCH_ASSOC);
    
    // ========================================
    // Summary Statistics (with discount breakdown)
    // ========================================
    $sqlSummary = "
        SELECT 
            SUM(oi.quantity * oi.price_per_unit) as gross_revenue,
            SUM(COALESCE(oi.net_total, oi.quantity * oi.price_per_unit)) as net_revenue,
            SUM(oi.quantity) as total_quantity,
            COUNT(DISTINCT o.id) as total_orders,
            COUNT(DISTINCT o.customer_id) as total_customers
        FROM order_items oi
        JOIN orders o ON oi.parent_order_id = o.id
        WHERE o.company_id = ?
        $dateFilter
        $statusFilter
        $employeeFilter
        AND (oi.is_freebie = 0 OR oi.is_freebie IS NULL)
    ";
    
    $stmt = $pdo->prepare($sqlSummary);
    $stmt->execute($params);
    $summary = $stmt->fetch(PDO::FETCH_ASSOC);
    
    // ========================================
    // Order Status Breakdown (Cancelled, Returned, BadDebt)
    // ========================================
    $sqlStatusBreakdown = "
        SELECT 
            o.order_status,
            SUM(oi.quantity * oi.price_per_unit) as gross_revenue,
            SUM(COALESCE(oi.net_total, oi.quantity * oi.price_per_unit)) as net_revenue,
            SUM(oi.quantity) as total_quantity,
            COUNT(DISTINCT o.id) as total_orders,
            COUNT(DISTINCT o.customer_id) as total_customers
        FROM order_items oi
        JOIN orders o ON oi.parent_order_id = o.id
        WHERE o.company_id = ?
        $dateFilter
        $employeeFilter
        AND o.order_status IN ('Cancelled', 'Returned', 'BadDebt')
        AND (oi.is_freebie = 0 OR oi.is_freebie IS NULL)
        GROUP BY o.order_status
        ORDER BY 
            CASE o.order_status 
                WHEN 'Cancelled' THEN 1 
                WHEN 'Returned' THEN 2 
                WHEN 'BadDebt' THEN 3 
            END
    ";
    
    $statusParams = array_merge([$companyId], $dateParams, $employeeParams);
    $stmt = $pdo->prepare($sqlStatusBreakdown);
    $stmt->execute($statusParams);
    $orderStatusBreakdown = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    json_response([
        'ok' => true,
        'year' => $year,
        'month' => $month,
        // DEBUG: Show which user was detected (remove after testing)
        '_debug' => [
            'detected_user_id' => $currentUserId,
            'detected_role' => $currentUserRole,
            'is_admin' => $isAdmin,
            'is_supervisor' => $isSupervisor
        ],
        'summary' => [
            'grossRevenue' => (float)($summary['gross_revenue'] ?? 0),
            'netRevenue' => (float)($summary['net_revenue'] ?? 0),
            'discountAmount' => (float)(($summary['gross_revenue'] ?? 0) - ($summary['net_revenue'] ?? 0)),
            'totalQuantity' => (int)($summary['total_quantity'] ?? 0),
            'totalOrders' => (int)($summary['total_orders'] ?? 0),
            'totalCustomers' => (int)($summary['total_customers'] ?? 0)
        ],
        'orderStatusBreakdown' => array_map(function($row) {
            $statusLabels = [
                'Cancelled' => 'ยกเลิก',
                'Returned' => 'ตีกลับ',
                'BadDebt' => 'หนี้สูญ'
            ];
            return [
                'status' => $row['order_status'],
                'statusLabel' => $statusLabels[$row['order_status']] ?? $row['order_status'],
                'grossRevenue' => (float)($row['gross_revenue'] ?? 0),
                'netRevenue' => (float)($row['net_revenue'] ?? 0),
                'quantity' => (int)($row['total_quantity'] ?? 0),
                'orders' => (int)($row['total_orders'] ?? 0),
                'customers' => (int)($row['total_customers'] ?? 0)
            ];
        }, $orderStatusBreakdown),
        'topProductsByValue' => array_map(function($row) {
            return [
                'id' => (int)$row['id'],
                'name' => $row['name'],
                'sku' => $row['sku'],
                'category' => $row['category'],
                'value' => (float)$row['total_value'],
                'quantity' => (int)$row['total_quantity']
            ];
        }, $topProductsByValue),
        'topProductsByQuantity' => array_map(function($row) {
            return [
                'id' => (int)$row['id'],
                'name' => $row['name'],
                'sku' => $row['sku'],
                'category' => $row['category'],
                'value' => (float)$row['total_value'],
                'quantity' => (int)$row['total_quantity']
            ];
        }, $topProductsByQuantity),
        'salesByCategory' => $salesByCategory,
        'monthlySalesBreakdown' => array_values($monthlyPivot),
        'othersDetail' => $othersDetail,
        'freebieByCategory' => $freebieByCategory,
        'freebieSummary' => [
            'totalQuantity' => (int)($freebieSummary['total_quantity'] ?? 0),
            'totalOrders' => (int)($freebieSummary['total_orders'] ?? 0)
        ],
        'employees' => array_map(function($row) {
            return [
                'id' => (int)$row['id'],
                'firstName' => $row['first_name'],
                'lastName' => $row['last_name'],
                'role' => $row['role']
            ];
        }, $employees)
    ]);
    
} catch (Exception $e) {
    error_log("Error in product_analysis.php: " . $e->getMessage());
    json_response([
        'ok' => false,
        'error' => 'Failed to fetch product analysis data',
        'message' => $e->getMessage()
    ], 500);
}
