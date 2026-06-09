<?php
/**
 * Cron Job: Sync JST Inventory
 * 
 * This script is intended to be run via a task scheduler (cron) every 10-15 minutes.
 * It loops through all companies that have JST_ACCOUNT_ID configured,
 * and calls the syncInventoryToDb() method to pull the latest stock
 * data into the local database table.
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../Services/JstErpService.php';

// Log file for this cron
$logFile = __DIR__ . '/../../storage/logs/cron_jst_sync_' . date('Y-m') . '.log';
function logCron($msg) {
    global $logFile;
    $dir = dirname($logFile);
    if (!is_dir($dir)) mkdir($dir, 0777, true);
    file_put_contents($logFile, date('Y-m-d H:i:s') . " - " . $msg . "\n", FILE_APPEND);
    echo $msg . "\n";
}

logCron("START: JST Inventory Sync");

try {
    $pdo = db_connect();

    // 1. Find all distinct companies that have JST credentials configured
    $stmt = $pdo->prepare("SELECT DISTINCT company_id FROM env WHERE `key` = 'JST_ACCOUNT_ID' AND `value` != ''");
    $stmt->execute();
    $companies = $stmt->fetchAll(PDO::FETCH_COLUMN);

    if (empty($companies)) {
        logCron("INFO: No companies found with JST_ACCOUNT_ID configured.");
    }

    foreach ($companies as $companyId) {
        logCron("Processing Company ID: " . $companyId);
        try {
            $service = new JstErpService($pdo, $companyId);
            $service->syncInventoryToDb('Cron');
            logCron("SUCCESS: Synced Company ID: " . $companyId);
        } catch (\Exception $e) {
            logCron("ERROR: Failed for Company ID: " . $companyId . " - " . $e->getMessage());
        }
    }

} catch (\Exception $e) {
    logCron("FATAL ERROR: " . $e->getMessage());
}

logCron("END: JST Inventory Sync\n");
