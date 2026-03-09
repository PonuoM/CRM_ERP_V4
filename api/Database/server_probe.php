<?php
/**
 * Server Probe — ตรวจสอบ spec ของ host
 * อัปโหลดผ่าน FTP แล้วเปิดใน browser
 * !! ลบทิ้งหลังใช้งาน !!
 */

// Simple auth key — change this!
$SECRET = 'probe2026';
if (($_GET['key'] ?? '') !== $SECRET) {
    http_response_code(403);
    die('Forbidden. Use ?key=' . $SECRET);
}

header('Content-Type: text/html; charset=utf-8');

echo '<html><head><meta charset="utf-8"><title>Server Probe</title>';
echo '<style>body{font-family:sans-serif;max-width:900px;margin:20px auto;padding:0 20px}table{border-collapse:collapse;width:100%;margin:10px 0}td,th{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f5f5f5}.ok{color:green;font-weight:bold}.no{color:red;font-weight:bold}.warn{color:orange;font-weight:bold}h2{margin-top:30px;border-bottom:2px solid #333;padding-bottom:5px}</style>';
echo '</head><body>';
echo '<h1>🔍 Server Probe</h1>';

// 1. PHP Info
echo '<h2>1. PHP Environment</h2>';
echo '<table>';
$phpInfo = [
    'PHP Version' => phpversion(),
    'OS' => PHP_OS,
    'SAPI' => php_sapi_name(),
    'Max Execution Time' => ini_get('max_execution_time') . 's',
    'Memory Limit' => ini_get('memory_limit'),
    'Upload Max Filesize' => ini_get('upload_max_filesize'),
    'Post Max Size' => ini_get('post_max_size'),
    'Timezone' => date_default_timezone_get(),
    'Document Root' => $_SERVER['DOCUMENT_ROOT'] ?? '-',
    'Script Path' => __FILE__,
    'Temp Dir' => sys_get_temp_dir(),
];
foreach ($phpInfo as $k => $v) {
    echo "<tr><th>$k</th><td>$v</td></tr>";
}
echo '</table>';

// 2. MySQL / Database
echo '<h2>2. Database</h2>';
echo '<table>';

// Check PDO
$hasPdo = extension_loaded('pdo_mysql');
echo '<tr><th>PDO MySQL</th><td class="' . ($hasPdo ? 'ok' : 'no') . '">' . ($hasPdo ? '✅ Available' : '❌ Not available') . '</td></tr>';

// Check mysqli
$hasMysqli = extension_loaded('mysqli');
echo '<tr><th>MySQLi</th><td class="' . ($hasMysqli ? 'ok' : 'no') . '">' . ($hasMysqli ? '✅ Available' : '❌ Not available') . '</td></tr>';

// Try to get MySQL version via config
$configFile = __DIR__ . '/../config.php';
if (file_exists($configFile)) {
    try {
        require_once $configFile;
        if (function_exists('db_connect')) {
            $pdo = db_connect();
            $ver = $pdo->query("SELECT VERSION()")->fetchColumn();
            echo '<tr><th>MySQL Version</th><td class="ok">' . $ver . '</td></tr>';

            // Check max_allowed_packet
            $packet = $pdo->query("SHOW VARIABLES LIKE 'max_allowed_packet'")->fetch(PDO::FETCH_ASSOC);
            echo '<tr><th>max_allowed_packet</th><td>' . number_format(($packet['Value'] ?? 0) / 1024 / 1024, 1) . ' MB</td></tr>';

            // Check databases accessible
            $dbs = $pdo->query("SHOW DATABASES")->fetchAll(PDO::FETCH_COLUMN);
            echo '<tr><th>Accessible Databases</th><td>' . implode(', ', $dbs) . '</td></tr>';

            // Count tables  
            $tables = $pdo->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN);
            echo '<tr><th>Tables in Current DB</th><td>' . count($tables) . ' tables</td></tr>';

            // Check GRANT permissions
            try {
                $grants = $pdo->query("SHOW GRANTS FOR CURRENT_USER()")->fetchAll(PDO::FETCH_COLUMN);
                echo '<tr><th>User Grants</th><td><pre style="margin:0;font-size:11px">' . htmlspecialchars(implode("\n", $grants)) . '</pre></td></tr>';
            } catch (Exception $e) {
                echo '<tr><th>User Grants</th><td class="warn">Cannot check: ' . $e->getMessage() . '</td></tr>';
            }
        }
    } catch (Exception $e) {
        echo '<tr><th>DB Connection</th><td class="no">❌ ' . htmlspecialchars($e->getMessage()) . '</td></tr>';
    }
} else {
    echo '<tr><th>Config</th><td class="warn">config.php not found at ' . $configFile . '</td></tr>';
}
echo '</table>';

// 3. Shell / Exec capabilities
echo '<h2>3. Shell Access & Functions</h2>';
echo '<table>';

$disabledFunctions = array_map('trim', explode(',', ini_get('disable_functions')));
$shellFuncs = ['exec', 'shell_exec', 'system', 'passthru', 'proc_open', 'popen'];
foreach ($shellFuncs as $fn) {
    $disabled = in_array($fn, $disabledFunctions);
    $exists = function_exists($fn);
    $status = $disabled ? '❌ Disabled' : ($exists ? '✅ Available' : '❌ Not found');
    $cls = $disabled ? 'no' : ($exists ? 'ok' : 'no');
    echo "<tr><th>$fn()</th><td class=\"$cls\">$status</td></tr>";
}

// Check mysqldump
$hasMysqldump = false;
if (function_exists('exec') && !in_array('exec', $disabledFunctions)) {
    @exec('which mysqldump 2>&1', $output, $ret);
    if ($ret === 0) {
        $hasMysqldump = true;
        echo '<tr><th>mysqldump</th><td class="ok">✅ ' . implode(' ', $output) . '</td></tr>';
    } else {
        @exec('mysqldump --version 2>&1', $output2, $ret2);
        if ($ret2 === 0) {
            $hasMysqldump = true;
            echo '<tr><th>mysqldump</th><td class="ok">✅ ' . implode(' ', $output2) . '</td></tr>';
        } else {
            echo '<tr><th>mysqldump</th><td class="no">❌ Not found in PATH</td></tr>';
        }
    }
} else {
    echo '<tr><th>mysqldump</th><td class="warn">⚠️ Cannot check (exec disabled)</td></tr>';
}

echo '<tr><th>disable_functions</th><td><pre style="margin:0;font-size:11px;word-wrap:break-word;max-width:600px">' . htmlspecialchars(ini_get('disable_functions') ?: '(none)') . '</pre></td></tr>';
echo '</table>';

// 4. File System
echo '<h2>4. File System</h2>';
echo '<table>';
$writableDirs = [
    'Current Dir' => __DIR__,
    'Temp Dir' => sys_get_temp_dir(),
    'API Dir' => __DIR__ . '/..',
];
foreach ($writableDirs as $label => $dir) {
    $writable = is_writable($dir);
    echo '<tr><th>' . $label . '</th><td class="' . ($writable ? 'ok' : 'no') . '">' . ($writable ? '✅ Writable' : '❌ Read-only') . ' (' . $dir . ')</td></tr>';
}

// Disk space
$free = @disk_free_space(__DIR__);
$total = @disk_total_space(__DIR__);
if ($free !== false && $total !== false) {
    echo '<tr><th>Disk Space</th><td>' . number_format($free / 1024 / 1024 / 1024, 2) . ' GB free / ' . number_format($total / 1024 / 1024 / 1024, 2) . ' GB total</td></tr>';
}
echo '</table>';

// 5. PHP Extensions
echo '<h2>5. Useful PHP Extensions</h2>';
echo '<table>';
$extensions = ['json', 'mbstring', 'curl', 'zip', 'gd', 'openssl', 'fileinfo', 'xml', 'simplexml', 'dom'];
foreach ($extensions as $ext) {
    $loaded = extension_loaded($ext);
    echo '<tr><th>' . $ext . '</th><td class="' . ($loaded ? 'ok' : 'warn') . '">' . ($loaded ? '✅' : '❌') . '</td></tr>';
}
echo '</table>';

// 6. Recommendation
echo '<h2>6. 🎯 Recommended Approach</h2>';
echo '<div style="background:#f0f0f0;padding:15px;border-radius:8px;margin:10px 0">';

$canExec = function_exists('exec') && !in_array('exec', $disabledFunctions);

if ($canExec && $hasMysqldump) {
    echo '<p class="ok">✅ mysqldump available → Can use shell-based export/import</p>';
}
if ($hasPdo) {
    echo '<p class="ok">✅ PDO MySQL available → Can use PHP-based schema export (SHOW CREATE TABLE) and data export (SELECT INTO OUTFILE or PHP loops)</p>';
    echo '<p>แนะนำ: <strong>PHP Script Approach</strong> — สร้าง endpoint สำหรับ export schema/data ผ่าน HTTP</p>';
}

echo '<ul>';
echo '<li><strong>Schema Sync</strong>: ใช้ SHOW CREATE TABLE → export เป็น SQL</li>';
echo '<li><strong>Data Backup</strong>: ใช้ SELECT + INSERT INTO → export/import ผ่าน PHP</li>';
echo '<li><strong>Migration</strong>: ใช้ระบบ migration ที่มีอยู่ (api/Database/*.sql) + endpoint execute</li>';
echo '</ul>';
echo '</div>';

echo '<p style="color:red;font-weight:bold;margin-top:30px">⚠️ ลบไฟล์นี้หลังใช้งาน!</p>';
echo '</body></html>';
