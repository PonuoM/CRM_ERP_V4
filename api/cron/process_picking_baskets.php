<?php
/**
 * Process Picking Baskets Cron Job
 * 
 * Purpose: Route customers with Picking/Shipping orders to correct baskets
 * 
 * Logic:
 * - มี Owner + ไม่อยู่ basket 51:
 *   - Telesale สร้าง Order หรือ Item → basket 39
 *   - ไม่มี Telesale involvement → basket 38
 * - ไม่มี Owner → SKIP (ให้ upsell_exit_handler.php จัดการ → 52)
 * - อยู่ basket 51 → SKIP (ให้ process_upsell_51_exit.php จัดการ)
 * 
 * URL: /api/cron/process_picking_baskets.php?secret=picking_basket_2026
 * 
 * Schedule: Every minute
 */

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/cron_logger.php';

// Initialize logger
$logger = new CronLogger('process_picking_baskets');
$logger->logStart();

// Allow CLI or Web with secret
$isCli = (php_sapi_name() === 'cli');
$secret = $_GET['secret'] ?? '';

if (!$isCli && $secret !== 'picking_basket_2026') {
    http_response_code(403);
    die(json_encode(['error' => 'Unauthorized']));
}

header('Content-Type: application/json; charset=utf-8');

// Basket constants
$BASKET_NEW_CUSTOMER = 38;   // ลูกค้าใหม่ (ขายไม่ได้)
$BASKET_PERSONAL_1_2M = 39;  // ส่วนตัว 1-2 เดือน (ขายได้)
$BASKET_UPSELL = 51;         // Upsell Dashboard (exclude - handled by process_upsell_51_exit.php)

try {
    $pdo = db_connect();
    
    $results = [
        'processed' => 0,
        'moved_to_39' => 0,
        'moved_to_38' => 0,
        'skipped_basket_51' => 0,
        'skipped_no_owner' => 0,
        'already_correct' => 0,
        'errors' => 0,
        'details' => []
    ];
    
    // Find customers with Picking/Shipping orders in last 7 days
    // Only process customers WITH owner and NOT in basket 51
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
        INNER JOIN customers c ON c.customer_id = o.customer_id
        LEFT JOIN users u ON u.id = o.creator_id
        WHERE o.order_status IN ('Picking', 'Shipping')
          AND o.order_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        ORDER BY o.order_date DESC
        LIMIT 200
    ");
    $stmt->execute();
    $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Prepare statements
    $telesaleOrderStmt = $pdo->prepare("
        SELECT COUNT(*) as cnt
        FROM orders o
        INNER JOIN users u ON o.creator_id = u.id
        WHERE o.customer_id = ?
          AND o.order_status IN ('Picking', 'Shipping')
          AND o.order_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)
          AND u.role_id IN (6, 7)
    ");
    
    $telesaleItemStmt = $pdo->prepare("
        SELECT COUNT(*) as cnt
        FROM order_items oi
        INNER JOIN orders o ON oi.parent_order_id = o.id
        INNER JOIN users u ON oi.creator_id = u.id
        WHERE o.customer_id = ?
          AND o.order_status IN ('Picking', 'Shipping')
          AND o.order_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)
          AND u.role_id IN (6, 7)
    ");
    
    $updateStmt = $pdo->prepare("
        UPDATE customers 
        SET current_basket_key = ?, basket_entered_date = NOW()
        WHERE customer_id = ?
    ");
    
    $logStmt = $pdo->prepare("
        INSERT INTO basket_transition_log 
        (customer_id, from_basket_key, to_basket_key, transition_type, triggered_by, notes, created_at)
        VALUES (?, ?, ?, 'sale_picking', NULL, ?, NOW())
    ");
    
    // Track processed customer IDs to avoid duplicates
    $processedCustomers = [];
    
    foreach ($orders as $order) {
        $customerPk = $order['customer_pk'];
        
        // Skip if already processed
        if (in_array($customerPk, $processedCustomers)) {
            continue;
        }
        $processedCustomers[] = $customerPk;
        
        $results['processed']++;
        
        $assignedTo = (int)($order['assigned_to'] ?? 0);
        $currentBasket = (int)($order['current_basket_key'] ?? 0);
        
        // RULE 1: Skip if no owner (let upsell_exit_handler.php handle → 52)
        if ($assignedTo <= 0) {
            $results['skipped_no_owner']++;
            $results['details'][] = ['customer' => $customerPk, 'action' => 'SKIP_NO_OWNER'];
            continue;
        }
        
        // RULE 2: Skip if in basket 51 (let process_upsell_51_exit.php handle)
        if ($currentBasket === $BASKET_UPSELL) {
            $results['skipped_basket_51']++;
            $results['details'][] = ['customer' => $customerPk, 'action' => 'SKIP_BASKET_51'];
            continue;
        }
        
        // Check Telesale involvement
        $telesaleOrderStmt->execute([$customerPk]);
        $telesaleOrders = (int)$telesaleOrderStmt->fetch(PDO::FETCH_ASSOC)['cnt'];
        
        $telesaleItemStmt->execute([$customerPk]);
        $telesaleItems = (int)$telesaleItemStmt->fetch(PDO::FETCH_ASSOC)['cnt'];
        
        $hasTelesaleInvolvement = ($telesaleOrders > 0 || $telesaleItems > 0);
        
        // Determine target basket
        $targetBasket = $hasTelesaleInvolvement ? $BASKET_PERSONAL_1_2M : $BASKET_NEW_CUSTOMER;
        $sellStatus = $hasTelesaleInvolvement ? 'ขายได้' : 'ขายไม่ได้';
        
        // Skip if already in correct basket
        if ($currentBasket === $targetBasket) {
            $results['already_correct']++;
            $results['details'][] = ['customer' => $customerPk, 'action' => 'ALREADY_CORRECT', 'basket' => $targetBasket];
            // Refresh basket_entered_date
            $pdo->prepare('UPDATE customers SET basket_entered_date = NOW() WHERE customer_id = ?')->execute([$customerPk]);
            continue;
        }
        
        // Execute update
        try {
            $updateStmt->execute([$targetBasket, $customerPk]);
            
            $notes = "$sellStatus - Telesale orders: $telesaleOrders, items: $telesaleItems. Moved by process_picking_baskets.php";
            $logStmt->execute([$customerPk, $currentBasket, $targetBasket, $notes]);
            
            if ($targetBasket === $BASKET_PERSONAL_1_2M) {
                $results['moved_to_39']++;
            } else {
                $results['moved_to_38']++;
            }
            
            $results['details'][] = [
                'customer' => $customerPk, 
                'action' => 'MOVED', 
                'from' => $currentBasket, 
                'to' => $targetBasket,
                'reason' => $sellStatus
            ];
            
        } catch (Exception $e) {
            $results['errors']++;
            $results['details'][] = ['customer' => $customerPk, 'action' => 'ERROR', 'message' => $e->getMessage()];
        }
    }
    
    $results['timestamp'] = date('Y-m-d H:i:s');
    
    // Log results to file
    $hasWork = ($results['moved_to_39'] > 0 || $results['moved_to_38'] > 0 || $results['errors'] > 0);
    $logger->log("Processed: {$results['processed']}, Moved to 39: {$results['moved_to_39']}, Moved to 38: {$results['moved_to_38']}");
    $logger->log("Skipped (51): {$results['skipped_basket_51']}, Skipped (no owner): {$results['skipped_no_owner']}, Already correct: {$results['already_correct']}");
    $logger->logEnd($hasWork);
    
    echo json_encode($results, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    
} catch (Exception $e) {
    $logger->logError($e->getMessage());
    // logError already triggers hasWork=true
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
