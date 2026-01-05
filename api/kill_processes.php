<?php
/**
 * Kill My MySQL Processes (Release Locks)
 * Access via: https://www.prima49.com/mini_erp/api/kill_processes.php
 */
require_once __DIR__ . '/config.php';

header('Content-Type: text/plain; charset=utf-8');

function log_msg($msg) {
    echo $msg . "\n";
    flush();
}

try {
    $pdo = db_connect();
    // Access global variables
    global $DB_USER;
    
    // Fallback if global not set
    if (!isset($DB_USER)) {
        // Just use current user from MySQL function
        $DB_USER = $pdo->query("SELECT SUBSTRING_INDEX(USER(), '@', 1)")->fetchColumn();
    }
    // Remove host part in case it's in format user@host (though SUBSTRING_INDEX handles it)
    $clean_db_user = explode('@', $DB_USER)[0];

    log_msg("--- Killing My Processes (User: $clean_db_user) ---");
    
    // Get current connection ID to avoid killing myself
    $stmt = $pdo->query("SELECT CONNECTION_ID()");
    $my_id = $stmt->fetchColumn();
    log_msg("My Connection ID: $my_id");
    
    // List processes
    $stmt = $pdo->query("SHOW FULL PROCESSLIST");
    $processes = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    $killed_count = 0;
    
    foreach ($processes as $p) {
        // Skip system processes and my own current connection
        if ($p['Id'] == $my_id) continue;
        
        // KILL only if MySQL Process User matches my user name
        // This is safer than relying on config file which might differ from actual DB user context
        if ($p['User'] == $clean_db_user || $p['User'] == $DB_USER) { 
            log_msg("Attempting to kill ID {$p['Id']} (User: {$p['User']}, Time: {$p['Time']}s, State: {$p['State']})...");
            try {
                $pdo->exec("KILL {$p['Id']}");
                log_msg("  ✓ Killed successfully.");
                $killed_count++;
            } catch (Exception $e) {
                log_msg("  ✗ Failed to kill: " . $e->getMessage());
            }
        }
    }
    
    if ($killed_count == 0) {
        log_msg("No other processes found for user '" . $clean_db_user . "'.");
    } else {
        log_msg("Done. Killed $killed_count processes.");
    }

} catch (Throwable $e) {
    log_msg("CRITICAL ERROR: " . $e->getMessage());
}
