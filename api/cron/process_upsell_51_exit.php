<?php
/**
 * Process Upsell Basket 51 Exit Cron Job
 * 
 * Purpose: Handle customers in basket 51 (Upsell Dashboard) when their order becomes 'Picking'
 * 
 * Logic:
 * - Customer current_basket_key = 51 (Upsell Dashboard)
 * - Customer has assigned_to (has owner)
 * - Order status changed to 'Picking' within last 7 days
 * 
 * Routing - "ขายได้" → Basket 39:
 * - Telesale (role 6,7) created NEW order for this customer after assignment
 * - OR Telesale added order_items to existing order
 * 
 * Routing - "ขายไม่ได้" → Basket 38:
 * - No Telesale involvement (only Admin orders/items)
 * 
 * URL: /api/cron/process_upsell_51_exit.php?key=upsell51_exit_2026_secret&dryrun=1
 * 
 * Suggested Schedule: Every 5 minutes
 */

header('Content-Type: text/plain; charset=utf-8');

$SECRET_KEY = 'upsell51_exit_2026_secret';
$inputKey = $_GET['key'] ?? '';

if ($inputKey !== $SECRET_KEY) {
    http_response_code(403);
    die("Access Denied.\n");
}

define('SKIP_AUTH', true);
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/cron_logger.php';

$logger = new CronLogger('process_upsell_51_exit');
$logger->logStart();

$dryRun = ($_GET['dryrun'] ?? '1') === '1';

echo "=====================================================\n";
echo "Process Upsell Basket 51 Exit\n";
echo "Date: " . date('Y-m-d H:i:s') . "\n";
echo "Mode: " . ($dryRun ? "DRY RUN (Preview Only)" : "⚠️ LIVE EXECUTION") . "\n";
echo "=====================================================\n\n";

// Basket constants
$SOURCE_BASKET = 51;        // Upsell Dashboard
$TARGET_SOLD = 39;          // 1-2 months personal (ขายได้)
$TARGET_NOT_SOLD = 38;      // New Customer personal (ขายไม่ได้)

try {
    $pdo = db_connect();
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    // Get all companies
    $companiesStmt = $pdo->query("SELECT id, name FROM companies ORDER BY id");
    $companies = $companiesStmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "Processing " . count($companies) . " companies...\n\n";
    
    $grandTotal = [
        'processed' => 0,
        'sold' => 0,
        'not_sold' => 0,
        'errors' => 0
    ];
    
    foreach ($companies as $company) {
        $companyId = $company['id'];
        $companyName = $company['name'];
        
        echo "=====================================================\n";
        echo "Company: {$companyId} - {$companyName}\n";
        echo "=====================================================\n\n";
        
        $results = [
            'processed' => 0,
            'sold' => 0,
            'not_sold' => 0,
            'errors' => 0
        ];
        
        // Query: Find customers in basket 51 with Picking orders in last 7 days
        // IMPORTANT: Exclude customers who still have Pending orders (still upsell opportunity)
        $sql = "
            SELECT DISTINCT
                c.customer_id,
                c.first_name,
                c.last_name,
                c.assigned_to,
                c.date_assigned,
                c.current_basket_key,
                o.id AS order_id,
                o.order_date,
                o.order_status
            FROM customers c
            INNER JOIN orders o ON c.customer_id = o.customer_id
            WHERE c.company_id = ?
              -- ลูกค้ามีเจ้าของ
              AND c.assigned_to IS NOT NULL AND c.assigned_to > 0
              -- อยู่ในถัง 51 (Upsell Dashboard)
              AND c.current_basket_key = ?
              -- มี Order สถานะ Picking
              AND o.order_status = 'Picking'
              -- Order เปลี่ยนสถานะภายใน 7 วัน
              AND o.order_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)
              -- ⚠️ ต้องไม่มี Pending Order อยู่ (ยังมีโอกาส Upsell)
              AND NOT EXISTS (
                  SELECT 1 FROM orders o2 
                  WHERE o2.customer_id = c.customer_id 
                  AND o2.order_status = 'Pending'
              )
            ORDER BY o.order_date DESC
        ";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$companyId, $SOURCE_BASKET]);
        $candidates = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo "Found " . count($candidates) . " candidates with Picking orders\n\n";
        
        if (empty($candidates)) {
            echo "No customers to process for this company.\n\n";
            continue;
        }
        
        // Prepare statements
        $updateStmt = $pdo->prepare("
            UPDATE customers 
            SET current_basket_key = ?,
                basket_entered_date = NOW()
            WHERE customer_id = ?
        ");
        
        $logStmt = $pdo->prepare("
            INSERT INTO basket_transition_log 
            (customer_id, from_basket_key, to_basket_key, transition_type, triggered_by, notes, created_at)
            VALUES (?, ?, ?, 'upsell_exit', ?, ?, NOW())
        ");
        
        // Query 1: Check if Telesale added order_items to ANY order
        $telesaleItemsStmt = $pdo->prepare("
            SELECT COUNT(*) as telesale_items
            FROM order_items oi
            INNER JOIN orders o ON oi.parent_order_id = o.id
            INNER JOIN users u ON oi.creator_id = u.id
            WHERE o.customer_id = ?
              AND o.order_status = 'Picking'
              AND o.order_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)
              AND u.role_id IN (6, 7)
        ");
        
        // Query 2: Check if Telesale created NEW order after customer was assigned
        $telesaleOrderStmt = $pdo->prepare("
            SELECT COUNT(*) as telesale_orders
            FROM orders o
            INNER JOIN users u ON o.creator_id = u.id
            WHERE o.customer_id = ?
              AND o.order_status = 'Picking'
              AND o.order_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)
              AND u.role_id IN (6, 7)
        ");
        
        foreach ($candidates as $row) {
            $results['processed']++;
            $customerId = $row['customer_id'];
            $assignedTo = $row['assigned_to'];
            
            echo "[{$results['processed']}] Customer: {$customerId} ({$row['first_name']} {$row['last_name']})\n";
            echo "    Assigned to: {$assignedTo}\n";
            
            // Check 1: Telesale added order_items
            $telesaleItemsStmt->execute([$customerId]);
            $telesaleItems = $telesaleItemsStmt->fetch(PDO::FETCH_ASSOC)['telesale_items'] ?? 0;
            
            // Check 2: Telesale created new order
            $telesaleOrderStmt->execute([$customerId]);
            $telesaleOrders = $telesaleOrderStmt->fetch(PDO::FETCH_ASSOC)['telesale_orders'] ?? 0;
            
            $hasTelesaleInvolvement = ($telesaleItems > 0 || $telesaleOrders > 0);
            $targetBasket = $hasTelesaleInvolvement ? $TARGET_SOLD : $TARGET_NOT_SOLD;
            
            $reasons = [];
            if ($telesaleOrders > 0) $reasons[] = "Telesale orders: $telesaleOrders";
            if ($telesaleItems > 0) $reasons[] = "Telesale items: $telesaleItems";
            $reasonStr = empty($reasons) ? "No Telesale involvement" : implode(", ", $reasons);
            
            $sellStatus = $hasTelesaleInvolvement ? "ขายได้" : "ขายไม่ได้";
            
            echo "    Check: $reasonStr\n";
            echo "    Decision: {$sellStatus} → Basket {$targetBasket}\n";
            
            if (!$dryRun) {
                try {
                    $pdo->beginTransaction();
                    
                    // Update customer basket
                    $updateStmt->execute([$targetBasket, $customerId]);
                    
                    // Log transition
                    $notes = "$sellStatus - $reasonStr";
                    $logStmt->execute([$customerId, $SOURCE_BASKET, $targetBasket, $assignedTo, $notes]);
                    
                    $pdo->commit();
                    
                    echo "    → MOVED to basket {$targetBasket}\n\n";
                    
                    if ($hasTelesaleInvolvement) {
                        $results['sold']++;
                    } else {
                        $results['not_sold']++;
                    }
                    
                } catch (Exception $e) {
                    $pdo->rollBack();
                    echo "    → ERROR: {$e->getMessage()}\n\n";
                    $results['errors']++;
                }
            } else {
                echo "    → WOULD MOVE (Dry Run)\n\n";
                if ($hasTelesaleInvolvement) {
                    $results['sold']++;
                } else {
                    $results['not_sold']++;
                }
            }
        }
        
        echo "Company {$companyId} Summary:\n";
        echo "  Processed: {$results['processed']}\n";
        echo "  Sold (→39): {$results['sold']}\n";
        echo "  Not Sold (→38): {$results['not_sold']}\n";
        echo "  Errors: {$results['errors']}\n\n";
        
        // Add to grand total
        $grandTotal['processed'] += $results['processed'];
        $grandTotal['sold'] += $results['sold'];
        $grandTotal['not_sold'] += $results['not_sold'];
        $grandTotal['errors'] += $results['errors'];
    }
    
    echo "=====================================================\n";
    echo "GRAND TOTAL (All Companies)\n";
    echo "=====================================================\n";
    echo "Processed:       {$grandTotal['processed']}\n";
    echo "Sold (→39):      {$grandTotal['sold']}\n";
    echo "Not Sold (→38):  {$grandTotal['not_sold']}\n";
    echo "Errors:          {$grandTotal['errors']}\n";
    echo "=====================================================\n";
    
    if ($dryRun) {
        echo "\nDRY RUN COMPLETE - No changes made\n";
        echo "To execute: add &dryrun=0 to URL\n";
        $logger->log("DRY RUN: Processed={$grandTotal['processed']}, Sold={$grandTotal['sold']}, NotSold={$grandTotal['not_sold']}");
        $logger->logEnd($grandTotal['processed'] > 0); // Log if found customers
    } else {
        echo "\nEXECUTION COMPLETE\n";
        $logger->log("EXECUTED: Processed={$grandTotal['processed']}, Sold→39={$grandTotal['sold']}, NotSold→38={$grandTotal['not_sold']}, Errors={$grandTotal['errors']}");
        $hasWork = ($grandTotal['sold'] > 0 || $grandTotal['not_sold'] > 0 || $grandTotal['errors'] > 0);
        $logger->logEnd($hasWork); // Log if moved customers or errors
    }
    
} catch (Exception $e) {
    $logger->logError($e->getMessage());
    // logError already triggers hasWork=true
    echo "FATAL ERROR: " . $e->getMessage() . "\n";
    echo "Line: " . $e->getLine() . "\n";
    echo "Trace: " . $e->getTraceAsString() . "\n";
}
