<?php
/**
 * Process Upsell Orders by Non-Owners
 * 
 * For customers with assigned_to (has owner):
 * - If there's a Pending order NOT created by the owner
 * - Move to basket 51 (Upsell Dashboard)
 * - Log transition with note about non-owner sale
 * - Update basket_entered_date and last_order_date
 * 
 * Run every minute via cron
 */

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

require_once __DIR__ . '/../config.php';

// Allow CLI or Web with secret
$isCli = (php_sapi_name() === 'cli');
$secret = $_GET['secret'] ?? '';

if (!$isCli && $secret !== 'upsell_process_2026') {
    http_response_code(403);
    die(json_encode(['error' => 'Unauthorized']));
}

header('Content-Type: application/json; charset=utf-8');

try {
    $pdo = db_connect();
    
    $results = [
        'processed' => 0,
        'moved_to_upsell' => 0,
        'already_upsell' => 0,
        'skipped' => 0,
        'details' => []
    ];
    
    // Find customers with:
    // 1. Has assigned_to (has owner)
    // 2. Has Pending order
    // 3. Order NOT created by the owner
    // 4. Not already in basket 51
    $stmt = $pdo->prepare("
        SELECT DISTINCT 
            o.id as order_id,
            o.order_date,
            o.creator_id,
            c.customer_id as customer_pk,
            c.assigned_to,
            c.current_basket_key,
            c.first_name,
            c.last_name,
            u.role_id as creator_role_id,
            CONCAT(u.first_name, ' ', u.last_name) as creator_name
        FROM orders o
        INNER JOIN customers c ON (c.customer_ref_id = o.customer_id OR c.customer_id = o.customer_id)
        LEFT JOIN users u ON u.id = o.creator_id
        WHERE o.order_status = 'Pending'
          AND c.assigned_to IS NOT NULL
          AND c.assigned_to > 0
          AND o.creator_id != c.assigned_to
          AND o.order_date >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
        ORDER BY o.order_date DESC
        LIMIT 200
    ");
    $stmt->execute();
    $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    foreach ($orders as $order) {
        $results['processed']++;
        
        $creatorId = (int)($order['creator_id'] ?? 0);
        $creatorName = $order['creator_name'] ?? 'Unknown';
        $creatorRoleId = (int)($order['creator_role_id'] ?? 0);
        $assignedTo = (int)($order['assigned_to'] ?? 0);
        $customerPk = $order['customer_pk'];
        $currentBasket = $order['current_basket_key'];
        $orderDate = $order['order_date'];
        
        // Skip if order was created by the owner
        if ($creatorId === $assignedTo) {
            $results['skipped']++;
            continue;
        }
        
        // CRITICAL: Double-check assigned_to must exist
        if ($assignedTo <= 0) {
            $results['skipped']++;
            $results['details'][] = [
                'customer' => $customerPk,
                'action' => 'SKIPPED_NO_OWNER',
                'reason' => 'assigned_to is null or 0'
            ];
            continue;
        }
        
        // Check if already in Upsell basket (51)
        if ($currentBasket == 51) {
            // Just update the date (but only if has owner)
            $pdo->prepare('
                UPDATE customers 
                SET basket_entered_date = NOW(), last_order_date = ? 
                WHERE customer_id = ? AND assigned_to IS NOT NULL AND assigned_to > 0
            ')->execute([$orderDate, $customerPk]);
            
            $results['already_upsell']++;
            $results['details'][] = [
                'customer' => $customerPk,
                'action' => 'REFRESHED_DATE',
                'creator' => $creatorName
            ];
            continue;
        }
        
        // MOVE to basket 51
        // 1. Update Customer basket
        $updateStmt = $pdo->prepare('
            UPDATE customers 
            SET current_basket_key = 51, 
                basket_entered_date = NOW(),
                last_order_date = ?
            WHERE customer_id = ?
        ');
        $updateStmt->execute([$orderDate, $customerPk]);
        
        // 2. Log Transition
        $roleNames = [
            1 => 'Super Admin',
            2 => 'Admin',
            3 => 'Admin Page',
            6 => 'Supervisor',
            7 => 'Telesale'
        ];
        $roleName = $roleNames[$creatorRoleId] ?? ('Role ' . $creatorRoleId);
        
        $note = "Upsell: มีผู้ขายที่ไม่ใช่เจ้าของ ({$creatorName}, {$roleName}) สร้าง Pending order";
        
        $logTrans = $pdo->prepare("
            INSERT INTO basket_transition_log 
                (customer_id, from_basket_key, to_basket_key, transition_type, triggered_by, notes, created_at)
            VALUES (?, ?, '51', 'upsell_by_other', ?, ?, NOW())
        ");
        $logTrans->execute([$customerPk, $currentBasket, $creatorId, $note]);
        
        $results['moved_to_upsell']++;
        $results['details'][] = [
            'customer' => $customerPk,
            'customer_name' => ($order['first_name'] ?? '') . ' ' . ($order['last_name'] ?? ''),
            'action' => 'MOVED_TO_UPSELL',
            'from_basket' => $currentBasket,
            'creator' => $creatorName,
            'creator_role' => $roleName
        ];
    }
    
    $results['timestamp'] = date('Y-m-d H:i:s');
    echo json_encode($results, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
