<?php
/**
 * Backup tables before running batch merge
 * Creates backup copies of all tables that will be modified by run_batch_merge.php
 * Suffix: _bak_20260426
 */
set_time_limit(600); // 10 minutes max

// Direct connection to remote server (bypasses local SQLSTATE 2054 issue)
$conn = new mysqli('202.183.192.218', 'primacom_bloguser', 'pJnL53Wkhju2LaGPytw8', 'primacom_mini_erp');
if ($conn->connect_error) {
    die("Database Connection Error: " . $conn->connect_error);
}
$conn->set_charset("utf8mb4");

$suffix = '_bak_20260426';

// All tables that run_batch_merge.php touches
$tables = [
    'customers',
    'orders',
    'call_history',
    'appointments',
    'activities',
    'customer_address',
    'customer_assignment_history',
    'customer_audit_log',
    'customer_logs',
    'customer_blocks',
    'customer_tags',
    'basket_transition_log',
    'basket_return_log',
];

echo "<html><head><title>Backup Before Merge</title>";
echo "<style>
body { font-family: 'Segoe UI', sans-serif; margin: 40px; background: #1a1a2e; color: #eee; }
h1 { color: #e94560; }
.success { color: #0f0; font-weight: bold; }
.error { color: #f00; font-weight: bold; }
.info { color: #aaa; }
table { border-collapse: collapse; margin-top: 20px; width: 100%; }
th, td { border: 1px solid #333; padding: 10px 15px; text-align: left; }
th { background: #16213e; color: #e94560; }
tr:nth-child(even) { background: #16213e; }
tr:nth-child(odd) { background: #0f3460; }
.summary { margin-top: 20px; padding: 20px; background: #16213e; border-radius: 10px; border: 1px solid #e94560; }
</style></head><body>";

echo "<h1>📦 Database Backup Before Merge</h1>";
echo "<p class='info'>Backup suffix: <strong>{$suffix}</strong> | Time: " . date('Y-m-d H:i:s') . "</p>";

if (!isset($_POST['run_backup']) && !isset($_GET['run'])) {
    echo "<h3>Tables to backup (" . count($tables) . " tables):</h3>";
    echo "<table><tr><th>#</th><th>Table</th><th>Backup Name</th></tr>";
    foreach ($tables as $i => $t) {
        echo "<tr><td>" . ($i + 1) . "</td><td>{$t}</td><td>{$t}{$suffix}</td></tr>";
    }
    echo "</table>";
    echo "<form method='POST' style='margin-top:30px;'>
        <button type='submit' name='run_backup' value='1' 
            style='padding:15px 40px; background:#e94560; color:white; font-size:18px; border:none; border-radius:8px; cursor:pointer; font-weight:bold;'>
            🚀 START BACKUP NOW
        </button>
    </form>";
    exit;
}

// Execute backup
echo "<h3>Backup Progress:</h3>";
echo "<table><tr><th>#</th><th>Table</th><th>Rows</th><th>Status</th><th>Time</th></tr>";

$totalRows = 0;
$successCount = 0;
$failCount = 0;

foreach ($tables as $i => $table) {
    $backupTable = $table . $suffix;
    $start = microtime(true);
    
    // Drop existing backup if exists
    $conn->query("DROP TABLE IF EXISTS `{$backupTable}`");
    
    // Create backup with structure + data
    $result = $conn->query("CREATE TABLE `{$backupTable}` AS SELECT * FROM `{$table}`");
    
    if ($result) {
        // Count rows
        $countResult = $conn->query("SELECT COUNT(*) as cnt FROM `{$backupTable}`");
        $row = $countResult->fetch_assoc();
        $rowCount = (int)$row['cnt'];
        $totalRows += $rowCount;
        
        $elapsed = round(microtime(true) - $start, 2);
        echo "<tr><td>" . ($i + 1) . "</td><td>{$table}</td><td>" . number_format($rowCount) . "</td>";
        echo "<td class='success'>✅ OK</td><td>{$elapsed}s</td></tr>";
        $successCount++;
    } else {
        $elapsed = round(microtime(true) - $start, 2);
        echo "<tr><td>" . ($i + 1) . "</td><td>{$table}</td><td>-</td>";
        echo "<td class='error'>❌ " . htmlspecialchars($conn->error) . "</td><td>{$elapsed}s</td></tr>";
        $failCount++;
    }
    
    // Flush output
    if (ob_get_level()) ob_flush();
    flush();
}

echo "</table>";

echo "<div class='summary'>";
echo "<h3>📊 Backup Summary</h3>";
echo "<p>✅ Success: <strong>{$successCount}</strong> / " . count($tables) . " tables</p>";
if ($failCount > 0) {
    echo "<p>❌ Failed: <strong>{$failCount}</strong></p>";
}
echo "<p>📦 Total rows backed up: <strong>" . number_format($totalRows) . "</strong></p>";
echo "<p class='info'>Backup tables have suffix: <code>{$suffix}</code></p>";
echo "<p class='info'>To restore a table: <code>DROP TABLE tablename; RENAME TABLE tablename{$suffix} TO tablename;</code></p>";
echo "</div>";

echo "</body></html>";
?>
