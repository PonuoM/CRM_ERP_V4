<?php
/**
 * Debug - Read auth error logs
 */
header('Content-Type: text/plain; charset=utf-8');
header('Access-Control-Allow-Origin: *');

$files = [
    'customers_error.log',
    'auth_error.log',
    'auth_debug.log', 
    'debug_check.log',
    'debug_counts.log'
];

foreach ($files as $file) {
    $path = __DIR__ . '/' . $file;
    echo "=== $file ===\n";
    if (file_exists($path)) {
        $content = file_get_contents($path);
        // Get last 5000 chars
        if (strlen($content) > 5000) {
            echo "...(truncated)...\n";
            echo substr($content, -5000);
        } else {
            echo $content;
        }
    } else {
        echo "(not found)\n";
    }
    echo "\n\n";
}

echo "=== PHP Error Log (last entries if accessible) ===\n";
$phpErrorLog = ini_get('error_log');
if ($phpErrorLog && file_exists($phpErrorLog) && is_readable($phpErrorLog)) {
    $content = file_get_contents($phpErrorLog);
    if (strlen($content) > 3000) {
        echo "...(truncated)...\n";
        echo substr($content, -3000);
    } else {
        echo $content;
    }
} else {
    echo "PHP error_log: $phpErrorLog (not accessible or not set)\n";
}
