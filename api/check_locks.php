<?php
/**
 * Check Locked Tables
 * Access via: https://www.prima49.com/mini_erp/api/check_locks.php
 */
require_once __DIR__ . '/config.php';

header('Content-Type: text/plain; charset=utf-8');

function log_msg($msg) {
    echo $msg . "\n";
}

try {
    $pdo = db_connect();
    // Access global variables from config.php
    global $DB_NAME;
    
    // Fallback if global not set (should not happen if config.php is required)
    if (!isset($DB_NAME)) {
        // Try to get from PDO DSN if possible, or just default
        $params = $pdo->query("SELECT DATABASE()")->fetchColumn();
        $DB_NAME = $params ?: 'mini_erp';
    }

    log_msg("--- Checking Locked Tables (DB: $DB_NAME) ---\n");

    // 1. Check Open Tables being used
    $stmt = $pdo->query("SHOW OPEN TABLES WHERE In_use > 0");
    $locks = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (empty($locks)) {
        log_msg("No tables are currently marked as 'In_use'.\n");
    } else {
        log_msg("LOCKED TABLES FOUND:\n");
        foreach ($locks as $l) {
            log_msg("- Database: {$l['Database']}");
            log_msg("  Table:    {$l['Table']}");
            log_msg("  In_use:   {$l['In_use']}");
            log_msg("  Name_locked: {$l['Name_locked']}");
            log_msg("--------------------------------");
        }
        
        log_msg("\nPossible Culprit Processes:\n");
        // Try to find process scanning this table
        $stmt = $pdo->query("SHOW FULL PROCESSLIST");
        $procs = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($procs as $p) {
            // Simple heuristic: if info contains table name or state is locking
            // Using $DB_NAME variable now
            if ($p['db'] == $DB_NAME && ($p['State'] == 'Locked' || $p['State'] == 'Waiting for table metadata lock' || strpos($p['Info'], 'appointments') !== false)) {
                 log_msg("ID: {$p['Id']} | User: {$p['User']} | Time: {$p['Time']}s | State: {$p['State']} | Info: " . substr($p['Info'], 0, 100));
            }
        }
    }
    
    log_msg("\nIf you see a process ID above that belongs to you, try running api/kill_processes.php again.");
    log_msg("If the ID belongs to 'system user' or another user, you MUST contact Hosting Support.");

} catch (Throwable $e) {
    log_msg("Error: " . $e->getMessage());
}
