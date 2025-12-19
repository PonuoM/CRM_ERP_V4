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
    
    if (!$companyId || !$count || empty($agentIds)) {
        json_response(['ok' => false, 'error' => 'Missing required parameters'], 400);
    }
    
    // Start transaction
    $pdo->beginTransaction();
    
    try {
        // Fetch customers ready to distribute
        $placeholders = str_repeat('?,', count($agentIds) - 1) . '?';
        $stmtFetch = $pdo->prepare("
            SELECT customer_id, customer_ref_id
            FROM customers
            WHERE company_id = ?
            AND assigned_to IS NULL
            AND (is_blocked IS NULL OR is_blocked = 0)
            AND (is_in_waiting_basket IS NULL OR is_in_waiting_basket = 0)
            ORDER BY RAND()
            LIMIT ?
        ");
        $stmtFetch->execute([$companyId, $count]);
        $customers = $stmtFetch->fetchAll(PDO::FETCH_ASSOC);
        
        if (empty($customers)) {
            $pdo->rollBack();
            json_response(['ok' => false, 'error' => 'No customers available for distribution'], 400);
        }
        
        // Prepare timestamps
        $now = date('Y-m-d H:i:s');
        $ownershipExpires = date('Y-m-d H:i:s', strtotime("+{$ownershipDays} days"));
        
        // Distribute customers among agents
        $assignments = array_fill_keys($agentIds, []);
        $agentIndex = 0;
        $agentCount = count($agentIds);
        
        foreach ($customers as $customer) {
            $customerId = $customer['customer_id'];
            
            // Simple round-robin distribution
            $agentId = $agentIds[$agentIndex];
            $assignments[$agentId][] = $customerId;
            
            $agentIndex = ($agentIndex + 1) % $agentCount;
        }
        
        // Update customers in bulk
        $stmtUpdate = $pdo->prepare("
            UPDATE customers
            SET assigned_to = ?,
                lifecycle_status = ?,
                date_assigned = ?,
                ownership_expires = ?,
                is_in_waiting_basket = 0,
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
        
        // Commit transaction
        $pdo->commit();
        
        // Prepare response
        $assignmentCounts = [];
        foreach ($assignments as $agentId => $customerIds) {
            $assignmentCounts[$agentId] = count($customerIds);
        }
        
        json_response([
            'ok' => true,
            'distributed' => $totalDistributed,
            'assignments' => $assignmentCounts,
            'skipped' => $count - $totalDistributed
        ]);
        
    } catch (Exception $e) {
        $pdo->rollBack();
        throw $e;
    }
    
} catch (Exception $e) {
    error_log("Error in bulk_distribute.php: " . $e->getMessage());
    json_response([
        'ok' => false,
        'error' => 'Failed to distribute customers',
        'message' => $e->getMessage()
    ], 500);
}
