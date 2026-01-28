<?php
/**
 * Process Upsell Distribution Cron Job
 * 
 * Purpose: Detect customers in distribution baskets (41,42,43,44,45,52) or NULL who have
 *          new Pending orders from Admin and move them to basket 53 (upsell_dis)
 * 
 * Logic:
 * - Customer current_basket_key IN (41, 42, 43, 44, 45, 52) OR NULL
 * - Customer assigned_to IS NULL (no owner)
 * - Has Order with status = 'Pending'
 * - Order creator is NOT Telesale (role_id NOT IN 6, 7)
 * → Move to basket_key = 53 (upsell_dis)
 * 
 * URL: /api/cron/process_upsell_distribution.php?key=upsell_dist_2026_secret&dryrun=1
 * 
 * Suggested Schedule: Every 10 minutes
 */

header('Content-Type: text/plain; charset=utf-8');

$SECRET_KEY = 'upsell_dist_2026_secret';
$inputKey = $_GET['key'] ?? '';

if ($inputKey !== $SECRET_KEY) {
    http_response_code(403);
    die("Access Denied.\n");
}

define('SKIP_AUTH', true);
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/cron_logger.php';

$logger = new CronLogger('process_upsell_distribution');
$logger->logStart();

$dryRun = ($_GET['dryrun'] ?? '1') === '1';

echo "=====================================================\n";
echo "Process Upsell Distribution (Basket 53)\n";
echo "Date: " . date('Y-m-d H:i:s') . "\n";
echo "Mode: " . ($dryRun ? "DRY RUN (Preview Only)" : "⚠️ LIVE EXECUTION") . "\n";
echo "=====================================================\n\n";

// Distribution baskets (no owner pool)
$DISTRIBUTION_BASKETS = [41, 42, 43, 44, 45, 52];
$TARGET_BASKET = 53; // upsell_dis

try {
    $pdo = db_connect();
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    // Get all companies
    $companiesStmt = $pdo->query("SELECT id, name FROM companies ORDER BY id");
    $companies = $companiesStmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "Processing " . count($companies) . " companies...\n\n";
    
    $grandTotal = [
        'processed' => 0,
        'moved' => 0,
        'skipped' => 0,
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
            'moved' => 0,
            'skipped' => 0,
            'errors' => 0,
            'details' => []
        ];
        
        // Query: Find customers in distribution baskets with Pending orders from non-Telesale
        $basketPlaceholders = implode(',', array_fill(0, count($DISTRIBUTION_BASKETS), '?'));
        
        $sql = "
            SELECT DISTINCT
                c.customer_id,
                c.first_name,
                c.last_name,
                c.current_basket_key,
                o.id AS order_id,
                o.order_date,
                o.creator_id,
                u.first_name AS creator_first_name,
                u.role_id AS creator_role
            FROM customers c
            INNER JOIN orders o ON c.customer_id = o.customer_id
            INNER JOIN users u ON o.creator_id = u.id
            WHERE c.company_id = ?
              -- ลูกค้าไม่มีเจ้าของ
              AND (c.assigned_to IS NULL OR c.assigned_to = 0)
              -- อยู่ในถัง Distribution (41,42,43,44,45,52) หรือ ยังไม่มี basket
              AND (c.current_basket_key IN ($basketPlaceholders) OR c.current_basket_key IS NULL)
              -- มี Order สถานะ Pending
              AND o.order_status = 'Pending'
              -- Order สร้างโดย Non-Telesale (ไม่ใช่ role 6, 7)
              AND u.role_id NOT IN (6, 7)
            ORDER BY o.order_date DESC
        ";
        
        $params = array_merge([$companyId], $DISTRIBUTION_BASKETS);
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $candidates = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo "Found " . count($candidates) . " candidates to move to basket $TARGET_BASKET\n\n";
        
        if (empty($candidates)) {
            echo "No customers to process for this company.\n\n";
            continue;
        }
        
        // Prepare update and log statements
        $updateStmt = $pdo->prepare("
            UPDATE customers 
            SET current_basket_key = ?,
                basket_entered_date = NOW()
            WHERE customer_id = ?
        ");
        
        $logStmt = $pdo->prepare("
            INSERT INTO basket_transition_log 
            (customer_id, from_basket_key, to_basket_key, transition_type, triggered_by, notes, created_at)
            VALUES (?, ?, ?, 'upsell_distribution', NULL, ?, NOW())
        ");
        
        foreach ($candidates as $row) {
            $results['processed']++;
            $customerId = $row['customer_id'];
            $currentBasket = $row['current_basket_key'];
            $orderId = $row['order_id'];
            $creatorName = $row['creator_first_name'];
            $creatorRole = $row['creator_role'];
            
            echo "[{$results['processed']}] Customer: {$customerId} ({$row['first_name']} {$row['last_name']})\n";
            echo "    Current Basket: " . ($currentBasket ?? 'NULL') . " → Target: {$TARGET_BASKET}\n";
            echo "    Pending Order: {$orderId} by {$creatorName} (role {$creatorRole})\n";
            
            // Check if already in target basket
            if ($currentBasket == $TARGET_BASKET) {
                echo "    → SKIP: Already in basket $TARGET_BASKET\n\n";
                $results['skipped']++;
                continue;
            }
            
            if (!$dryRun) {
                try {
                    $pdo->beginTransaction();
                    
                    // Update customer basket
                    $updateStmt->execute([$TARGET_BASKET, $customerId]);
                    
                    // Log transition
                    $fromBasket = $currentBasket ?? 'NULL';
                    $notes = "Moved from basket $fromBasket to $TARGET_BASKET. Order $orderId (Pending) created by $creatorName (role $creatorRole)";
                    $logStmt->execute([$customerId, $currentBasket, $TARGET_BASKET, $notes]);
                    
                    $pdo->commit();
                    
                    echo "    → MOVED to basket {$TARGET_BASKET}\n\n";
                    $results['moved']++;
                    
                } catch (Exception $e) {
                    $pdo->rollBack();
                    echo "    → ERROR: {$e->getMessage()}\n\n";
                    $results['errors']++;
                }
            } else {
                echo "    → WOULD MOVE (Dry Run)\n\n";
                $results['moved']++;
            }
        }
        
        echo "Company {$companyId} Summary: Processed={$results['processed']}, Moved={$results['moved']}, Skipped={$results['skipped']}, Errors={$results['errors']}\n\n";
        
        // Add to grand total
        $grandTotal['processed'] += $results['processed'];
        $grandTotal['moved'] += $results['moved'];
        $grandTotal['skipped'] += $results['skipped'];
        $grandTotal['errors'] += $results['errors'];
    }
    
    echo "=====================================================\n";
    echo "GRAND TOTAL (All Companies)\n";
    echo "=====================================================\n";
    echo "Processed: {$grandTotal['processed']}\n";
    echo "Moved:     {$grandTotal['moved']}\n";
    echo "Skipped:   {$grandTotal['skipped']}\n";
    echo "Errors:    {$grandTotal['errors']}\n";
    echo "=====================================================\n";
    
    if ($dryRun) {
        echo "\nDRY RUN COMPLETE - No changes made\n";
        echo "To execute: add &dryrun=0 to URL\n";
        $logger->log("DRY RUN: Processed={$grandTotal['processed']}, Would move={$grandTotal['moved']}");
    } else {
        echo "\nEXECUTION COMPLETE\n";
        $logger->log("EXECUTED: Processed={$grandTotal['processed']}, Moved→53={$grandTotal['moved']}, Skipped={$grandTotal['skipped']}, Errors={$grandTotal['errors']}");
    }
    $logger->logEnd();
    
} catch (Exception $e) {
    $logger->logError($e->getMessage());
    $logger->logEnd();
    echo "FATAL ERROR: " . $e->getMessage() . "\n";
    echo "Line: " . $e->getLine() . "\n";
    echo "Trace: " . $e->getTraceAsString() . "\n";
}
