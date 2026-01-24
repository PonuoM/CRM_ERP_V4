<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

require_once __DIR__ . '/../config.php';

// Allow CLI or Web with secret
$isCli = (php_sapi_name() === 'cli');
$secret = $_GET['secret'] ?? '';

if (!$isCli && $secret !== 'picking_basket_2026') {
    http_response_code(403);
    die(json_encode(['error' => 'Unauthorized']));
}

header('Content-Type: application/json; charset=utf-8');

try {
    $pdo = db_connect();
    
    $results = [
        'processed' => 0,
        'moved' => 0,
        'skipped' => 0,
        'details' => []
    ];
    
    $stmt = $pdo->prepare("
        SELECT DISTINCT 
            o.id as order_id,
            o.customer_id,
            o.creator_id,
            c.customer_id as customer_pk,
            c.assigned_to,
            c.current_basket_key,
            u.role_id as creator_role_id
        FROM orders o
        INNER JOIN customers c ON (c.customer_ref_id = o.customer_id OR c.customer_id = o.customer_id)
        LEFT JOIN users u ON u.id = o.creator_id
        WHERE o.order_status = 'Picking'
          AND c.current_basket_key != 39
          AND o.order_date >= DATE_SUB(NOW(), INTERVAL 30 MINUTE)
        LIMIT 100
    ");
    $stmt->execute();
    $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    foreach ($orders as $order) {
        $results['processed']++;
        
        $creatorRoleId = (int)($order['creator_role_id'] ?? 0);
        $assignedTo = (int)($order['assigned_to'] ?? 0);
        $creatorId = (int)($order['creator_id'] ?? 0);
        $customerPk = $order['customer_pk'];
        
        $isTelesale = ($creatorRoleId === 6 || $creatorRoleId === 7);
        $isOwner = ($assignedTo > 0 && $assignedTo === $creatorId);
        
        if ($isTelesale && $isOwner) {
            $pdo->prepare('UPDATE customers SET current_basket_key = 39 WHERE customer_id = ?')->execute([$customerPk]);
            $results['moved']++;
            $results['details'][] = ['customer' => $customerPk, 'action' => 'MOVED'];
        } else {
            $results['skipped']++;
            $results['details'][] = ['customer' => $customerPk, 'action' => 'SKIPPED'];
        }
    }
    
    $results['timestamp'] = date('Y-m-d H:i:s');
    echo json_encode($results, JSON_PRETTY_PRINT);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
