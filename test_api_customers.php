<?php
// Test API endpoint directly
require_once 'api/config.php';

cors();

try {
    $pdo = db_connect();
    
    $userId = 1655;
    $companyId = 1;
    
    echo "=== Test API GET /customers with assignedTo={$userId} ===\n\n";
    
    // Simulate the API call parameters
    $_GET['companyId'] = $companyId;
    $_GET['assignedTo'] = $userId;
    $_GET['pageSize'] = 10;
    $_GET['page'] = 1;
    
    echo "Parameters:\n";
    echo "  - companyId: {$companyId}\n";
    echo "  - assignedTo: {$userId}\n";
    echo "  - pageSize: 10\n";
    echo "  - page: 1\n\n";
    
    // Build query like the API does
    $where = ['1'];
    $params = [];
    
    if ($companyId) { 
        $where[] = 'company_id = ?'; 
        $params[] = $companyId; 
    }
    
    if ($userId) { 
        $where[] = 'assigned_to = ?'; 
        $params[] = (int)$userId; 
    }
    
    $whereSql = implode(' AND ', $where);
    
    echo "SQL WHERE clause: $whereSql\n";
    echo "Params: " . json_encode($params) . "\n\n";
    
    // Get total count
    $countStmt = $pdo->prepare("SELECT COUNT(*) FROM customers WHERE $whereSql");
    $countStmt->execute($params);
    $total = (int)$countStmt->fetchColumn();
    
    echo "Total matching customers: {$total}\n\n";
    
    // Get data
    $sql = "SELECT 
                customer_id,
                customer_ref_id,
                first_name,
                last_name,
                phone,
                province,
                company_id,
                assigned_to,
                lifecycle_status,
                date_assigned
            FROM customers 
            WHERE $whereSql 
            ORDER BY date_assigned DESC
            LIMIT 10";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $customers = $stmt->fetchAll();
    
    echo "Query returned " . count($customers) . " customers\n\n";
    
    if (count($customers) > 0) {
        echo "Sample customers:\n";
        foreach ($customers as $i => $c) {
            echo ($i + 1) . ". [{$c['customer_id']}] {$c['first_name']} {$c['last_name']} | Phone: {$c['phone']}\n";
            echo "   Assigned to: {$c['assigned_to']}, Status: {$c['lifecycle_status']}\n";
        }
    }
    
    echo "\n=== API Response ===\n";
    $response = [
        'total' => $total,
        'data' => $customers
    ];
    echo json_encode($response, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    echo "\n";
    
} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
    echo "Trace: " . $e->getTraceAsString() . "\n";
}
