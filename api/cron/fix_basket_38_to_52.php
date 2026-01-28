<?php
/**
 * Fix Script: Move No-Owner Customers from Basket 38 to 52
 * 
 * ย้ายลูกค้าที่ไม่มี owner จาก basket 38 (Dashboard) ไป 52 (Distribution)
 * เพื่อให้ถูกแจกเป็น Upsell
 * 
 * URL: /api/cron/fix_basket_38_to_52.php?key=fix38to52_secret&dryrun=1
 */

header('Content-Type: text/plain; charset=utf-8');

$SECRET_KEY = 'fix38to52_secret';
$inputKey = $_GET['key'] ?? '';

if ($inputKey !== $SECRET_KEY) {
    http_response_code(403);
    die("Access Denied.\n");
}

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/cron_logger.php';

$logger = new CronLogger('fix_basket_38_to_52');
$logger->logStart();

$dryRun = ($_GET['dryrun'] ?? '1') === '1';

echo "=====================================================\n";
echo "Fix: Move No-Owner from Basket 38 to 52\n";
echo "Date: " . date('Y-m-d H:i:s') . "\n";
echo "Mode: " . ($dryRun ? "DRY RUN (Preview Only)" : "⚠️ LIVE EXECUTION") . "\n";
echo "=====================================================\n\n";

try {
    $pdo = db_connect();
    
    // Find customers in basket 38 with no owner who have Picking orders in last 7 days
    $sql = "
        SELECT DISTINCT
            c.customer_id,
            c.first_name,
            c.last_name,
            c.current_basket_key,
            c.assigned_to,
            o.id as order_id,
            o.order_status,
            o.order_date
        FROM customers c
        INNER JOIN orders o ON c.customer_id = o.customer_id
        WHERE c.current_basket_key = 38
          AND (c.assigned_to IS NULL OR c.assigned_to = 0)
          AND o.order_status IN ('Picking', 'Shipping')
          AND o.order_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        ORDER BY o.order_date DESC
    ";
    
    $stmt = $pdo->query($sql);
    $customers = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    $count = count($customers);
    echo "Found: $count customers in basket 38 with no owner\n\n";
    
    if ($count === 0) {
        echo "No customers to fix.\n";
        $logger->log("No customers to fix");
        $logger->logEnd();
        exit;
    }
    
    $moved = 0;
    $errors = 0;
    
    foreach ($customers as $c) {
        echo "[{$c['customer_id']}] {$c['first_name']} {$c['last_name']}\n";
        echo "    Order: {$c['order_id']} ({$c['order_status']}) - {$c['order_date']}\n";
        
        if (!$dryRun) {
            try {
                // Update to basket 52
                $updateStmt = $pdo->prepare("
                    UPDATE customers 
                    SET current_basket_key = 52, basket_entered_date = NOW()
                    WHERE customer_id = ?
                ");
                $updateStmt->execute([$c['customer_id']]);
                
                // Log transition
                $logStmt = $pdo->prepare("
                    INSERT INTO basket_transition_log 
                    (customer_id, from_basket_key, to_basket_key, transition_type, notes, created_at)
                    VALUES (?, 38, 52, 'fix_script', 'Fixed: No-owner in basket 38 moved to 52 for distribution', NOW())
                ");
                $logStmt->execute([$c['customer_id']]);
                
                echo "    → MOVED to basket 52\n\n";
                $moved++;
                
            } catch (Exception $e) {
                echo "    → ERROR: {$e->getMessage()}\n\n";
                $errors++;
            }
        } else {
            echo "    → WOULD MOVE to basket 52 (Dry Run)\n\n";
            $moved++;
        }
    }
    
    echo "=====================================================\n";
    echo "SUMMARY\n";
    echo "=====================================================\n";
    echo "Total Found: $count\n";
    echo "Moved:       $moved\n";
    echo "Errors:      $errors\n";
    echo "=====================================================\n";
    
    if ($dryRun) {
        echo "\nDRY RUN COMPLETE - No changes made\n";
        echo "To execute: add &dryrun=0 to URL\n";
        $logger->log("DRY RUN: Found $count customers to move");
    } else {
        echo "\nEXECUTION COMPLETE\n";
        $logger->log("EXECUTED: Moved $moved customers from 38 to 52, Errors: $errors");
    }
    $logger->logEnd();
    
} catch (Exception $e) {
    $logger->logError($e->getMessage());
    $logger->logEnd();
    echo "FATAL ERROR: " . $e->getMessage() . "\n";
}
