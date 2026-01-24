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
        $currentBasket = $order['current_basket_key'];
        
        $isTelesale = ($creatorRoleId === 6 || $creatorRoleId === 7);
        $isOwner = ($assignedTo > 0 && $assignedTo === $creatorId);
        
        if ($isTelesale && $isOwner) {
            if ($currentBasket != 39) {
                // CASE 1: MOVE needed
                // 1. Update Customer: Move to basket 39 AND update date
                $pdo->prepare('UPDATE customers SET current_basket_key = 39, basket_entered_date = NOW() WHERE customer_id = ?')->execute([$customerPk]);
                
                // 2. Log Transition
                $logTrans = $pdo->prepare("
                    INSERT INTO basket_transition_log (customer_id, from_basket_key, to_basket_key, transition_type, triggered_by, notes, created_at)
                    VALUES (?, ?, '39', 'sale_picking', ?, 'Moved by process_picking_baskets.php', NOW())
                ");
                $logTrans->execute([$customerPk, $currentBasket, $creatorId]);

                // 3. Log Return
                $logReturn = $pdo->prepare("
                    INSERT INTO basket_return_log (customer_id, previous_assigned_to, reason, days_since_last_order, batch_date, created_at)
                    VALUES (?, ?, 'Sale (Picking) - Moved to Personal Basket', 0, CURDATE(), NOW())
                ");
                $logReturn->execute([$customerPk, $assignedTo]);

                $results['moved']++;
                $results['details'][] = ['customer' => $customerPk, 'action' => 'MOVED'];
            } else {
                // CASE 2: ALREADY in basket 39 -> Just refresh date
                $pdo->prepare('UPDATE customers SET basket_entered_date = NOW() WHERE customer_id = ?')->execute([$customerPk]);
                $results['details'][] = ['customer' => $customerPk, 'action' => 'REFRESHED_DATE'];
            }
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
