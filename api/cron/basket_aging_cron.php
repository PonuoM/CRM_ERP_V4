<?php
/**
 * Unified Basket Aging Cron
 * 
 * Purpose: Move customers who exceeded fail_after_days in their basket
 * Schedule: Daily at midnight (or per business requirements)
 * 
 * This is the ONLY basket-related cronjob needed after Event-Driven implementation.
 * All other transitions happen real-time via API hooks in BasketRoutingServiceV2.
 * 
 * Usage:
 * - Dry run: /api/cron/basket_aging_cron.php?key=basket_aging_2026_secret&dryrun=1
 * - Execute: /api/cron/basket_aging_cron.php?key=basket_aging_2026_secret&dryrun=0
 * 
 * @author AI Assistant
 * @date 2026-02-05
 */

error_reporting(E_ALL);
ini_set('display_errors', 1);

header('Content-Type: text/plain; charset=utf-8');

// Security check
$expectedKey = 'basket_aging_2026_secret';
$providedKey = $_GET['key'] ?? '';

if ($providedKey !== $expectedKey) {
    http_response_code(403);
    die("Access denied. Invalid key.");
}

$dryRun = !isset($_GET['dryrun']) || $_GET['dryrun'] !== '0';

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/cron_logger.php';
require_once __DIR__ . '/../Services/BasketRoutingServiceV2.php';

$logger = new CronLogger('basket_aging_cron');
$logger->logStart();

echo "=====================================================\n";
echo "Unified Basket Aging Cron\n";
echo "Date: " . date('Y-m-d H:i:s') . "\n";
echo "Mode: " . ($dryRun ? "DRY RUN (Preview Only)" : "LIVE EXECUTION") . "\n";
echo "=====================================================\n\n";

try {
    $pdo = db_connect();
    
    $router = new BasketRoutingServiceV2($pdo);
    $results = $router->processAgingCustomers($dryRun);
    
    echo "=====================================================\n";
    echo "SUMMARY\n";
    echo "=====================================================\n";
    echo "Processed: {$results['processed']}\n";
    echo "Moved:     {$results['moved']}\n";
    echo "Errors:    {$results['errors']}\n";
    echo "=====================================================\n\n";
    
    if (!empty($results['details'])) {
        echo "Details:\n";
        foreach ($results['details'] as $i => $detail) {
            $num = $i + 1;
            if (isset($detail['error'])) {
                echo "[{$num}] Customer #{$detail['customer_id']}: ERROR - {$detail['error']}\n";
            } else {
                $action = $dryRun ? "WOULD MOVE" : "MOVED";
                echo "[{$num}] Customer #{$detail['customer_id']}: {$action} from {$detail['from']} to {$detail['to']}\n";
            }
        }
    }
    
    if ($dryRun) {
        echo "\nDRY RUN COMPLETE - No changes made\n";
        echo "To execute: add &dryrun=0 to URL\n";
        $logger->log("DRY RUN: Processed={$results['processed']}, Would move={$results['moved']}");
    } else {
        $logger->log("EXECUTED: Processed={$results['processed']}, Moved={$results['moved']}, Errors={$results['errors']}");
    }
    
    $logger->logEnd($results['processed'] > 0);
    
} catch (PDOException $e) {
    $logger->logError($e->getMessage());
    echo "Database error: " . $e->getMessage() . "\n";
    exit(1);
} catch (Exception $e) {
    $logger->logError($e->getMessage());
    echo "Error: " . $e->getMessage() . "\n";
    exit(1);
}
