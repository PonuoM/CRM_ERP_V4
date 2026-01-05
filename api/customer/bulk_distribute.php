<?php
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
    
    // Get POST data
    $input = json_decode(file_get_contents('php://input'), true);
    
    $companyId = isset($input['companyId']) ? (int)$input['companyId'] : null;
    $count = isset($input['count']) ? (int)$input['count'] : null;
    $agentIds = isset($input['agentIds']) ? $input['agentIds'] : [];
    $targetStatus = isset($input['targetStatus']) ? $input['targetStatus'] : 'DailyDistribution';
    $ownershipDays = isset($input['ownershipDays']) ? (int)$input['ownershipDays'] : 30;
    
    // New parameters
    $filters = isset($input['filters']) ? $input['filters'] : [];
    $mode = isset($filters['mode']) ? $filters['mode'] : 'all'; 
    $gradeFilter = isset($filters['grade']) ? $filters['grade'] : null;

    if (!$companyId || !$count || empty($agentIds)) {
        json_response(['ok' => false, 'error' => 'Missing required parameters'], 400);
    }
    
    $pdo->beginTransaction();
    
    try {
        // --- QUERY BUILDER ---
        
        // Base columns
        $select = "SELECT c.customer_id, c.customer_ref_id, c.grade, c.date_registered, c.last_follow_up_date, c.total_purchases";
        $from = "FROM customers c";
        $where = ["c.company_id = ?", "(c.is_blocked IS NULL OR c.is_blocked = 0)"];
        $params = [$companyId];
        $orderBy = "";
        
        switch ($mode) {
            case 'new_sale': // "เพิ่งขาย (Admin)"
                // Logic from api/index.php:
                // Customers who have an order within 7 days created by Admin or specific channels
                // AND are not currently assigned
                $from .= " JOIN orders o ON o.customer_id = c.customer_id";
                $from .= " LEFT JOIN users u ON u.id = o.creator_id";
                
                $where[] = "c.assigned_to IS NULL";
                $where[] = "(c.is_in_waiting_basket IS NULL OR c.is_in_waiting_basket = 0)";
                $where[] = "(u.role = 'Admin Page' OR o.sales_channel IS NOT NULL OR o.sales_channel_page_id IS NOT NULL)";
                $where[] = "(o.order_status IS NULL OR o.order_status <> 'Cancelled')";
                $where[] = "TIMESTAMPDIFF(DAY, o.order_date, NOW()) <= 7"; // Recent 7 days
                
                // Group by to avoid duplicates from multiple orders
                $groupBy = "GROUP BY c.customer_id";
                
                // Sort: Newest Order Date First
                $orderBy = "ORDER BY MAX(o.order_date) DESC";
                break;

            case 'waiting_return': // "คืนจากตะกร้า"
                $where[] = "c.is_in_waiting_basket = 1";
                $where[] = "DATEDIFF(NOW(), c.waiting_basket_start_date) >= 30";
                
                // Clear the ghost follow-up date condition if they've been in basket 30 days
                // Since 30 > 7, the last_follow_up_date check is naturally satisfied
                // but we keep a loose check for safety
                $where[] = "(c.last_follow_up_date IS NULL OR DATEDIFF(NOW(), c.last_follow_up_date) > 7)";
                
                // Sort: Longest time since last follow up (Oldest in basket first)
                $orderBy = "ORDER BY c.waiting_basket_start_date ASC, c.last_follow_up_date ASC"; 
                break;

            case 'stock': // "สต๊อกรอแจก"
                $where[] = "c.assigned_to IS NULL";
                // Stock can include those NOT in basket, OR those in basket who have finished their 30 days
                $where[] = "(c.is_in_waiting_basket = 0 OR (c.is_in_waiting_basket = 1 AND DATEDIFF(NOW(), c.waiting_basket_start_date) >= 30))";
                
                // Exclude those that match 'new_sale' criteria
                $where[] = "NOT EXISTS (
                    SELECT 1 FROM orders o
                    LEFT JOIN users u ON u.id = o.creator_id
                    WHERE o.customer_id = c.customer_id
                      AND (u.role = 'Admin Page' OR o.sales_channel IS NOT NULL OR o.sales_channel_page_id IS NOT NULL)
                      AND (o.order_status IS NULL OR o.order_status <> 'Cancelled')
                      AND TIMESTAMPDIFF(DAY, o.order_date, NOW()) <= 7
                )";
                
                // Sort: Grade First, then Oldest Created
                $orderBy = "
                    ORDER BY 
                    CASE WHEN c.grade = 'A' THEN 1 WHEN c.grade = 'B' THEN 2 WHEN c.grade = 'C' THEN 3 ELSE 4 END ASC,
                    c.date_registered ASC
                ";
                break;

            case 'grade': 
                if ($gradeFilter) {
                    $where[] = "c.grade = ?";
                    $params[] = $gradeFilter;
                }
                $where[] = "c.assigned_to IS NULL";
                $where[] = "(c.is_in_waiting_basket IS NULL OR c.is_in_waiting_basket = 0)";
                $orderBy = "ORDER BY c.date_registered DESC";
                break;

            case 'all': 
            default:
                // General pool
                $where[] = "c.assigned_to IS NULL";
                $where[] = "(c.is_in_waiting_basket IS NULL OR c.is_in_waiting_basket = 0)";
                $where[] = "(c.last_follow_up_date IS NULL OR DATEDIFF(NOW(), c.last_follow_up_date) > 7)";

                // Weighted Score:
                // We need to check 'Is New Sale' inside the query for scoring
                // Subquery for "Is New Sale" score
                $isNewSaleScore = "
                    (SELECT COUNT(*) FROM orders o 
                     LEFT JOIN users u ON u.id = o.creator_id
                     WHERE o.customer_id = c.customer_id
                     AND (u.role = 'Admin Page' OR o.sales_channel IS NOT NULL)
                     AND TIMESTAMPDIFF(DAY, o.order_date, NOW()) <= 7
                    ) * 100000
                ";

                $orderBy = "
                    ORDER BY (
                        COALESCE((" . $isNewSaleScore . "), 0) +
                        (CASE WHEN c.grade = 'A' THEN 50000 WHEN c.grade = 'B' THEN 10000 ELSE 0 END) +
                        (CASE WHEN c.date_registered > DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1000 ELSE 0 END)
                    ) DESC, 
                    c.date_registered DESC
                ";
                break;
        }

        $query = $select . " " . $from . " WHERE " . implode(" AND ", $where);
        if (isset($groupBy)) {
            $query .= " " . $groupBy;
        }
        $query .= " " . $orderBy . " LIMIT ?";
        $params[] = $count;

        // Execute Fetch
        $stmtFetch = $pdo->prepare($query);
        $stmtFetch->execute($params);
        $customers = $stmtFetch->fetchAll(PDO::FETCH_ASSOC);
        
        if (empty($customers)) {
            $pdo->rollBack();
            json_response([
                'ok' => false, 
                'error' => 'ไม่พบลูกค้าที่พร้อมแจกสำหรับเงื่อนไขนี้',
                'debug_mode' => $mode,
                'count' => 0
            ], 400); 
        }
        
        // Prepare timestamps
        $now = date('Y-m-d H:i:s');
        $ownershipExpires = date('Y-m-d H:i:s', strtotime("+{$ownershipDays} days"));
        
        // Distribute
        $assignments = array_fill_keys($agentIds, []);
        $agentIndex = 0;
        $agentCount = count($agentIds);
        
        foreach ($customers as $customer) {
            $customerId = $customer['customer_id'];
            $agentId = $agentIds[$agentIndex];
            $assignments[$agentId][] = $customerId;
            $agentIndex = ($agentIndex + 1) % $agentCount;
        }
        
        // Update
        $stmtUpdate = $pdo->prepare("
            UPDATE customers
            SET assigned_to = ?,
                lifecycle_status = ?,
                date_assigned = ?,
                ownership_expires = ?,
                is_in_waiting_basket = 0,
                waiting_basket_start_date = NULL,
                is_blocked = 0
            WHERE customer_id = ?
        ");
        
        $totalDistributed = 0;
        foreach ($assignments as $agentId => $customerIds) {
            foreach ($customerIds as $customerId) {
                $stmtUpdate->execute([
                    $agentId,
                    $targetStatus,
                    $now,
                    $ownershipExpires,
                    $customerId
                ]);
                $totalDistributed++;
            }
        }
        
        $pdo->commit();
        
        $assignmentCounts = [];
        foreach ($assignments as $agentId => $customerIds) {
            $assignmentCounts[$agentId] = count($customerIds);
        }
        
        json_response([
            'ok' => true,
            'distributed' => $totalDistributed,
            'assignments' => $assignmentCounts,
            'skipped' => $count - $totalDistributed,
            'mode' => $mode
        ]);
        
    } catch (Exception $e) {
        $pdo->rollBack();
        throw $e;
    }
    
} catch (Throwable $e) {
    error_log("Error in bulk_distribute.php: " . $e->getMessage() . " | Line: " . $e->getLine() . " | File: " . $e->getFile());
    error_log("Stack trace: " . $e->getTraceAsString());
    json_response([
        'ok' => false,
        'error' => 'Failed to distribute customers: ' . $e->getMessage(),
        'line' => $e->getLine(),
        'file' => basename($e->getFile())
    ], 500);
}
