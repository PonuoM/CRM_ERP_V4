<?php
/**
 * View Basket Debug Log
 * URL: /api/cron/view_basket_log.php
 */

require_once __DIR__ . '/../config.php';

header('Content-Type: text/html; charset=utf-8');

$logFile = __DIR__ . '/../basket_debug.log';

echo "<html><head><meta charset='utf-8'><title>Basket Debug Log</title>";
echo "<style>
    body { font-family: monospace; padding: 20px; background: #1e1e1e; color: #d4d4d4; }
    .log-entry { margin: 5px 0; padding: 5px; }
    .picking { background: #143d14; }
    .refresh { color: #4fc3f7; }
    pre { white-space: pre-wrap; word-wrap: break-word; }
    .btn { display: inline-block; padding: 10px 20px; background: #4CAF50; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
</style></head><body>";

echo "<h1>📋 Basket Debug Log</h1>";
echo "<p>Log file: {$logFile}</p>";
echo "<a class='btn' href='?clear=1'>🗑️ Clear Log</a> ";
echo "<a class='btn refresh' style='background:#2196F3;' href='?'>🔄 Refresh</a>";

if (isset($_GET['clear'])) {
    file_put_contents($logFile, "Log cleared at " . date('Y-m-d H:i:s') . "\n");
    echo "<p style='color: #4CAF50;'>✅ Log cleared!</p>";
}

echo "<hr>";

if (file_exists($logFile)) {
    $content = file_get_contents($logFile);
    $lines = explode("\n", $content);
    $lines = array_reverse($lines); // Show newest first
    
    echo "<h2>Log Entries (newest first):</h2>";
    echo "<pre>";
    foreach ($lines as $line) {
        if (empty(trim($line))) continue;
        
        $class = '';
        if (strpos($line, 'PICKING') !== false) {
            $class = 'picking';
        }
        
        echo "<div class='log-entry {$class}'>" . htmlspecialchars($line) . "</div>";
    }
    echo "</pre>";
} else {
    echo "<p style='color: orange;'>⚠️ Log file does not exist yet. Make a PATCH request to an order to generate logs.</p>";
}

echo "</body></html>";
?>
