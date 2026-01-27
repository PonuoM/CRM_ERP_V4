<?php
/**
 * Fix Basket 38 → 39 for customers with Telesale involvement
 * 
 * Purpose: Find customers in basket 38 who should be in basket 39 because:
 * - Telesale created order for them, OR
 * - Telesale added order_items to their order
 * 
 * URL: /api/cron/fix_basket_38_to_39.php?key=fix_basket_2026_secret&dryrun=1
 */

header('Content-Type: text/plain; charset=utf-8');

$SECRET_KEY = 'fix_basket_2026_secret';
$inputKey = $_GET['key'] ?? '';

if ($inputKey !== $SECRET_KEY) {
    http_response_code(403);
    die("Access Denied.\n");
}

define('SKIP_AUTH', true);
require_once __DIR__ . '/../config.php';

$dryRun = ($_GET['dryrun'] ?? '1') === '1';

echo "=====================================================\n";
echo "Fix Basket 38 → 39 (Telesale Involvement)\n";
echo "Date: " . date('Y-m-d H:i:s') . "\n";
echo "Mode: " . ($dryRun ? "DRY RUN (Preview Only)" : "⚠️ LIVE EXECUTION") . "\n";
echo "=====================================================\n\n";

try {
    $pdo = db_connect();
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    // Query: Find customers in basket 38 with Telesale involvement
    // Either: Telesale created order OR Telesale added order_items
    $sql = "
        SELECT DISTINCT
            c.customer_id,
            c.first_name,
            c.last_name,
            c.phone,
            c.assigned_to,
            c.current_basket_key,
            'Telesale Order' as reason,
            o.id as order_id,
            o.order_date,
            o.order_status,
            u.id as creator_id,
            u.role_id
        FROM customers c
        INNER JOIN orders o ON c.customer_id = o.customer_id
        INNER JOIN users u ON o.creator_id = u.id
        WHERE c.current_basket_key = 38
          AND c.assigned_to IS NOT NULL AND c.assigned_to > 0
          AND u.role_id IN (6, 7)  -- Telesale created order
          AND o.order_date >= '2026-01-25 00:00:00'\r\n          AND o.order_date <= '2026-01-28 23:59:59'
        
        UNION
        
        SELECT DISTINCT
            c.customer_id,
            c.first_name,
            c.last_name,
            c.phone,
            c.assigned_to,
            c.current_basket_key,
            'Telesale Items' as reason,
            o.id as order_id,
            o.order_date,
            o.order_status,
            u.id as creator_id,
            u.role_id
        FROM customers c
        INNER JOIN orders o ON c.customer_id = o.customer_id
        INNER JOIN order_items oi ON o.id = oi.parent_order_id
        INNER JOIN users u ON oi.creator_id = u.id
        WHERE c.current_basket_key = 38
          AND c.assigned_to IS NOT NULL AND c.assigned_to > 0
          AND u.role_id IN (6, 7)  -- Telesale added items
          AND o.order_date >= '2026-01-25 00:00:00'\r\n          AND o.order_date <= '2026-01-28 23:59:59'
        
        ORDER BY customer_id
    ";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    $customers = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Group by customer_id to avoid duplicates
    $uniqueCustomers = [];
    foreach ($customers as $row) {
        $customerId = $row['customer_id'];
        if (!isset($uniqueCustomers[$customerId])) {
            $uniqueCustomers[$customerId] = $row;
        } else {
            // Append reason if different
            if ($uniqueCustomers[$customerId]['reason'] !== $row['reason']) {
                $uniqueCustomers[$customerId]['reason'] = 'Telesale Order + Items';
            }
        }
    }
    
    echo "Found " . count($uniqueCustomers) . " customers in basket 38 with Telesale involvement\n\n";
    
    if (empty($uniqueCustomers)) {
        echo "No customers to fix.\n";
        exit;
    }
    
    // Prepare statements
    $updateStmt = $pdo->prepare("
        UPDATE customers 
        SET current_basket_key = 39,
            basket_entered_date = NOW()
        WHERE customer_id = ?
    ");
    
    $logStmt = $pdo->prepare("
        INSERT INTO basket_transition_log 
        (customer_id, from_basket_key, to_basket_key, transition_type, notes, created_at)
        VALUES (?, 38, 39, 'fix_manual', ?, NOW())
    ");
    
    $movedCount = 0;
    $errorCount = 0;
    
    foreach ($uniqueCustomers as $customerId => $row) {
        echo "[" . ($movedCount + $errorCount + 1) . "] Customer: {$customerId} ({$row['first_name']} {$row['last_name']})\n";
        echo "    Phone: {$row['phone']}\n";
        echo "    Assigned to: {$row['assigned_to']}\n";
        echo "    Reason: {$row['reason']}\n";
        echo "    Order: {$row['order_id']} ({$row['order_status']}) - {$row['order_date']}\n";
        echo "    Creator ID: {$row['creator_id']} (Role: {$row['role_id']})\n";
        
        if (!$dryRun) {
            try {
                $pdo->beginTransaction();
                
                $updateStmt->execute([$customerId]);
                $logStmt->execute([$customerId, "Fixed: Was in 38, moved to 39 due to {$row['reason']}"]);
                
                $pdo->commit();
                
                echo "    → MOVED to basket 39\n\n";
                $movedCount++;
                
            } catch (Exception $e) {
                $pdo->rollBack();
                echo "    → ERROR: {$e->getMessage()}\n\n";
                $errorCount++;
            }
        } else {
            echo "    → WOULD MOVE to basket 39 (Dry Run)\n\n";
            $movedCount++;
        }
    }
    
    echo "=====================================================\n";
    echo "SUMMARY\n";
    echo "=====================================================\n";
    echo "Total Found: " . count($uniqueCustomers) . "\n";
    echo "Moved:       {$movedCount}\n";
    echo "Errors:      {$errorCount}\n";
    echo "=====================================================\n";
    
    if ($dryRun) {
        echo "\nDRY RUN COMPLETE - No changes made\n";
        echo "To execute: add &dryrun=0 to URL\n";
    } else {
        echo "\nEXECUTION COMPLETE\n";
    }
    
} catch (Exception $e) {
    echo "FATAL ERROR: " . $e->getMessage() . "\n";
    echo "Line: " . $e->getLine() . "\n";
    echo "Trace: " . $e->getTraceAsString() . "\n";
}
