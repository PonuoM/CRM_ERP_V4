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
        
        require_once __DIR__ . '/distribution_helper.php';
        
        switch ($mode) {
            case 'new_sale': 
                $parts = DistributionHelper::getNewSaleParts($companyId, 7);
                $from .= " " . $parts['join'];
                $where = [$parts['where']];
                $params = $parts['params'];
                $orderBy = $parts['orderBy'];
                $groupBy = $parts['groupBy'];
                break;

            case 'waiting_return':
                $parts = DistributionHelper::getWaitingReturnParts($companyId);
                $from .= " " . $parts['join'];
                $where = [$parts['where']];
                $params = $parts['params'];
                $orderBy = $parts['orderBy'];
                break;

            case 'stock':
                $parts = DistributionHelper::getStockParts($companyId, 7);
                $from .= " " . $parts['join'];
                $where = [$parts['where']];
                $params = $parts['params'];
                $orderBy = $parts['orderBy'];
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
                $parts = DistributionHelper::getGeneralPoolParts($companyId);
                $from .= " " . $parts['join'];
                $where = [$parts['where']];
                $params = $parts['params'];
                $orderBy = $parts['orderBy'];
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
                is_blocked = 0,
                bucket_type = 'ready'
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
