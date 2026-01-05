<?php
/**
 * Check MySQL Process List
 * Access via: https://www.prima49.com/mini_erp/api/check_db_processes.php
 */
require_once __DIR__ . '/config.php';

header('Content-Type: text/plain; charset=utf-8');

try {
    $pdo = db_connect();
    echo "--- MySQL Process List ---\n\n";
    
    // Show full process list
    $stmt = $pdo->query("SHOW FULL PROCESSLIST");
    $processes = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo sprintf("%-8s | %-15s | %-15s | %-8s | %-8s | %-s\n", "ID", "User", "Host", "Time", "Command", "Info");
    echo str_repeat("-", 100) . "\n";
    
    foreach ($processes as $p) {
        $info = $p['Info'];
        if (strlen($info) > 50) $info = substr($info, 0, 47) . '...';
        if (empty($info)) $info = '[None]';
        
        echo sprintf("%-8s | %-15s | %-15s | %-8s | %-8s | %-s\n", 
            $p['Id'], 
            substr($p['User'], 0, 15), 
            substr($p['Host'], 0, 15), 
            $p['Time'], 
            $p['Command'], 
            $info
        );
    }
    
    echo "\n\n--- Warning ---\n";
    echo "This script only lists processes. You cannot kill other users' processes on shared hosting.\n";
    echo "However, if you see many 'Sleep' or 'Locked' processes from your user, they might be the cause.";

} catch (Throwable $e) {
    echo "Error: " . $e->getMessage();
}
