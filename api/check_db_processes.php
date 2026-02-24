<?php
/**
 * MySQL Process Monitor — เช็ค process ที่ค้างอยู่ใน MySQL
 * ใช้งาน: เปิดในเบราว์เซอร์ https://www.prima49.com/mini_erp/api/check_db_processes.php
 * 
 * แสดงข้อมูล:
 * 1. สรุปจำนวน connections ทั้งหมด
 * 2. Process ที่รันนานเกิน 5 วินาที (อาจเป็นปัญหา)
 * 3. Process ทั้งหมดที่กำลังรันอยู่
 * 4. ตาราง/row ที่ถูก lock อยู่
 * 5. ปุ่มสำหรับ kill process ที่ค้าง
 */

ini_set('display_errors', 0);
error_reporting(E_ALL);

require_once __DIR__ . '/config.php';

header('Content-Type: text/html; charset=utf-8');

// Handle KILL request
if (isset($_GET['kill']) && is_numeric($_GET['kill'])) {
    try {
        $pdo = db_connect();
        $pid = (int)$_GET['kill'];
        $pdo->exec("KILL $pid");
        echo "<script>alert('Process $pid killed successfully'); window.location.href='check_db_processes.php';</script>";
        exit;
    } catch (Exception $e) {
        echo "<script>alert('Error killing process: " . addslashes($e->getMessage()) . "'); window.location.href='check_db_processes.php';</script>";
        exit;
    }
}

// Handle KILL ALL long queries
if (isset($_GET['kill_all_long']) && $_GET['kill_all_long'] === '1') {
    try {
        $pdo = db_connect();
        $threshold = isset($_GET['threshold']) ? (int)$_GET['threshold'] : 30;
        $stmt = $pdo->query("SELECT ID FROM information_schema.PROCESSLIST WHERE COMMAND != 'Sleep' AND TIME > $threshold AND USER != 'system user' AND INFO IS NOT NULL");
        $killed = 0;
        while ($row = $stmt->fetch()) {
            try {
                $pdo->exec("KILL " . $row['ID']);
                $killed++;
            } catch (Exception $e) {
                // Skip if process already finished
            }
        }
        echo "<script>alert('Killed $killed processes (> {$threshold}s)'); window.location.href='check_db_processes.php';</script>";
        exit;
    } catch (Exception $e) {
        echo "<script>alert('Error: " . addslashes($e->getMessage()) . "'); window.location.href='check_db_processes.php';</script>";
        exit;
    }
}

try {
    $pdo = db_connect();
} catch (Exception $e) {
    die("❌ Cannot connect to database: " . $e->getMessage());
}

// 1. Get all processes
$processes = $pdo->query("SELECT * FROM information_schema.PROCESSLIST ORDER BY TIME DESC")->fetchAll();

// 2. Get InnoDB status for lock info
$innodbStatus = '';
try {
    $row = $pdo->query("SHOW ENGINE INNODB STATUS")->fetch();
    $innodbStatus = $row['Status'] ?? '';
} catch (Exception $e) {
    $innodbStatus = 'Cannot retrieve InnoDB status: ' . $e->getMessage();
}

// 3. Get lock waits (MySQL 5.7+)
$lockWaits = [];
try {
    $lockWaits = $pdo->query("
        SELECT 
            r.trx_id AS waiting_trx_id,
            r.trx_mysql_thread_id AS waiting_thread,
            r.trx_query AS waiting_query,
            r.trx_wait_started AS wait_started,
            b.trx_id AS blocking_trx_id,
            b.trx_mysql_thread_id AS blocking_thread,
            b.trx_query AS blocking_query,
            TIMESTAMPDIFF(SECOND, r.trx_wait_started, NOW()) AS wait_seconds
        FROM information_schema.INNODB_LOCK_WAITS w
        JOIN information_schema.INNODB_TRX b ON b.trx_id = w.blocking_trx_id
        JOIN information_schema.INNODB_TRX r ON r.trx_id = w.requesting_trx_id
        ORDER BY wait_seconds DESC
    ")->fetchAll();
} catch (Exception $e) {
    // MySQL 8+ uses performance_schema instead
    try {
        $lockWaits = $pdo->query("
            SELECT 
                r.trx_id AS waiting_trx_id,
                r.trx_mysql_thread_id AS waiting_thread,
                r.trx_query AS waiting_query,
                r.trx_wait_started AS wait_started,
                b.trx_id AS blocking_trx_id,
                b.trx_mysql_thread_id AS blocking_thread,
                b.trx_query AS blocking_query,
                TIMESTAMPDIFF(SECOND, r.trx_wait_started, NOW()) AS wait_seconds
            FROM performance_schema.data_lock_waits w
            JOIN information_schema.INNODB_TRX b ON b.trx_id = w.BLOCKING_ENGINE_TRANSACTION_ID
            JOIN information_schema.INNODB_TRX r ON r.trx_id = w.REQUESTING_ENGINE_TRANSACTION_ID
            ORDER BY wait_seconds DESC
        ")->fetchAll();
    } catch (Exception $e2) {
        // Skip lock waits if not available
    }
}

// 4. Get global status
$maxConn = $pdo->query("SHOW VARIABLES LIKE 'max_connections'")->fetch();
$threadsConn = $pdo->query("SHOW STATUS LIKE 'Threads_connected'")->fetch();
$threadsRun = $pdo->query("SHOW STATUS LIKE 'Threads_running'")->fetch();
$waitTimeout = $pdo->query("SHOW VARIABLES LIKE 'wait_timeout'")->fetch();

// 5. Categorize processes
$longQueries = array_filter($processes, fn($p) => $p['COMMAND'] !== 'Sleep' && (int)$p['TIME'] > 5 && $p['INFO'] !== null);
$sleepConn = array_filter($processes, fn($p) => $p['COMMAND'] === 'Sleep');
$activeQueries = array_filter($processes, fn($p) => $p['COMMAND'] !== 'Sleep' && $p['INFO'] !== null);

?>
<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🔍 MySQL Process Monitor</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, sans-serif; background: #0f172a; color: #e2e8f0; padding: 20px; }
        h1 { color: #38bdf8; margin-bottom: 20px; }
        h2 { color: #fbbf24; margin: 20px 0 10px; font-size: 1.2em; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 20px; }
        .stat-card { background: #1e293b; border-radius: 10px; padding: 16px; border-left: 4px solid #38bdf8; }
        .stat-card.warn { border-left-color: #f59e0b; }
        .stat-card.danger { border-left-color: #ef4444; }
        .stat-card .label { font-size: 0.8em; color: #94a3b8; }
        .stat-card .value { font-size: 1.8em; font-weight: bold; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 0.85em; }
        th { background: #334155; padding: 8px 10px; text-align: left; position: sticky; top: 0; }
        td { padding: 6px 10px; border-bottom: 1px solid #334155; max-width: 400px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        td:hover { white-space: normal; word-break: break-all; }
        tr:hover { background: #1e293b; }
        tr.long-query { background: #451a03; }
        tr.lock-wait { background: #4c0519; }
        .btn { padding: 4px 10px; border: none; border-radius: 4px; cursor: pointer; font-size: 0.8em; color: white; }
        .btn-kill { background: #ef4444; }
        .btn-kill:hover { background: #dc2626; }
        .btn-kill-all { background: #dc2626; padding: 8px 16px; font-size: 0.9em; margin: 10px 0; }
        .btn-refresh { background: #3b82f6; padding: 8px 16px; font-size: 0.9em; text-decoration: none; color: white; border-radius: 6px; display: inline-block; margin-bottom: 20px; }
        .section { background: #1e293b; border-radius: 10px; padding: 16px; margin-bottom: 20px; overflow-x: auto; }
        .badge { padding: 2px 8px; border-radius: 10px; font-size: 0.75em; }
        .badge-danger { background: #ef4444; }
        .badge-warn { background: #f59e0b; color: #000; }
        .badge-ok { background: #22c55e; }
        .timestamp { color: #64748b; font-size: 0.85em; margin-bottom: 10px; }
        .no-data { color: #64748b; padding: 10px; font-style: italic; }
    </style>
</head>
<body>
    <h1>🔍 MySQL Process Monitor</h1>
    <p class="timestamp">⏰ เวลาเช็ค: <?= date('Y-m-d H:i:s') ?> | <a href="check_db_processes.php" class="btn-refresh">🔄 Refresh</a></p>

    <!-- Summary Stats -->
    <div class="stats">
        <div class="stat-card">
            <div class="label">Total Connections</div>
            <div class="value"><?= $threadsConn['Value'] ?? '?' ?></div>
            <div class="label">Max: <?= $maxConn['Value'] ?? '?' ?></div>
        </div>
        <div class="stat-card <?= ((int)($threadsRun['Value'] ?? 0)) > 10 ? 'warn' : '' ?>">
            <div class="label">Active Threads</div>
            <div class="value"><?= $threadsRun['Value'] ?? '?' ?></div>
        </div>
        <div class="stat-card <?= count($longQueries) > 0 ? 'danger' : '' ?>">
            <div class="label">Long Queries (>5s)</div>
            <div class="value"><?= count($longQueries) ?></div>
        </div>
        <div class="stat-card">
            <div class="label">Sleep Connections</div>
            <div class="value"><?= count($sleepConn) ?></div>
        </div>
        <div class="stat-card <?= count($lockWaits) > 0 ? 'danger' : '' ?>">
            <div class="label">Lock Waits</div>
            <div class="value"><?= count($lockWaits) ?></div>
        </div>
        <div class="stat-card">
            <div class="label">Wait Timeout</div>
            <div class="value" style="font-size:1.2em"><?= $waitTimeout['Value'] ?? '?' ?>s</div>
        </div>
    </div>

    <!-- Long Running Queries (DANGER) -->
    <?php if (count($longQueries) > 0): ?>
    <div class="section" style="border: 2px solid #ef4444;">
        <h2>🚨 Query ที่รันนาน (>5 วินาที) — ควร Kill!</h2>
        <button class="btn btn-kill-all" onclick="if(confirm('Kill ALL processes running > 30 seconds?')) window.location.href='?kill_all_long=1&threshold=30'">
            ⚡ Kill All > 30s
        </button>
        <table>
            <tr>
                <th>ID</th><th>User</th><th>Host</th><th>DB</th><th>Command</th><th>Time(s)</th><th>State</th><th>Query</th><th>Action</th>
            </tr>
            <?php foreach ($longQueries as $p): ?>
            <tr class="long-query">
                <td><?= $p['ID'] ?></td>
                <td><?= htmlspecialchars($p['USER']) ?></td>
                <td><?= htmlspecialchars($p['HOST']) ?></td>
                <td><?= htmlspecialchars($p['DB'] ?? '-') ?></td>
                <td><?= htmlspecialchars($p['COMMAND']) ?></td>
                <td><strong><?= $p['TIME'] ?>s</strong>
                    <?php if ((int)$p['TIME'] > 30): ?><span class="badge badge-danger">⚠️ CRITICAL</span>
                    <?php elseif ((int)$p['TIME'] > 10): ?><span class="badge badge-warn">⚠️ SLOW</span>
                    <?php endif; ?>
                </td>
                <td><?= htmlspecialchars($p['STATE'] ?? '-') ?></td>
                <td title="<?= htmlspecialchars($p['INFO'] ?? '') ?>"><?= htmlspecialchars(substr($p['INFO'] ?? '', 0, 120)) ?></td>
                <td><button class="btn btn-kill" onclick="if(confirm('Kill process <?= $p['ID'] ?>?')) window.location.href='?kill=<?= $p['ID'] ?>'">Kill</button></td>
            </tr>
            <?php endforeach; ?>
        </table>
    </div>
    <?php else: ?>
    <div class="section" style="border: 2px solid #22c55e;">
        <h2>✅ ไม่มี Query ที่รันนานผิดปกติ</h2>
        <p class="no-data">ทุก query ใช้เวลาน้อยกว่า 5 วินาที — สถานะปกติ</p>
    </div>
    <?php endif; ?>

    <!-- Lock Waits -->
    <?php if (count($lockWaits) > 0): ?>
    <div class="section" style="border: 2px solid #f59e0b;">
        <h2>🔒 Lock Waits — Process ที่ถูก Block</h2>
        <table>
            <tr>
                <th>Waiting Thread</th><th>Waiting Query</th><th>Wait Time</th>
                <th>Blocking Thread</th><th>Blocking Query</th><th>Action</th>
            </tr>
            <?php foreach ($lockWaits as $lw): ?>
            <tr class="lock-wait">
                <td><?= $lw['waiting_thread'] ?></td>
                <td title="<?= htmlspecialchars($lw['waiting_query'] ?? '') ?>"><?= htmlspecialchars(substr($lw['waiting_query'] ?? '?', 0, 80)) ?></td>
                <td><strong><?= $lw['wait_seconds'] ?>s</strong></td>
                <td><?= $lw['blocking_thread'] ?></td>
                <td title="<?= htmlspecialchars($lw['blocking_query'] ?? '') ?>"><?= htmlspecialchars(substr($lw['blocking_query'] ?? '?', 0, 80)) ?></td>
                <td><button class="btn btn-kill" onclick="if(confirm('Kill blocking process <?= $lw['blocking_thread'] ?>?')) window.location.href='?kill=<?= $lw['blocking_thread'] ?>'">Kill Blocker</button></td>
            </tr>
            <?php endforeach; ?>
        </table>
    </div>
    <?php endif; ?>

    <!-- Active Queries -->
    <div class="section">
        <h2>⚡ Active Queries (<?= count($activeQueries) ?>)</h2>
        <?php if (count($activeQueries) > 0): ?>
        <table>
            <tr><th>ID</th><th>User</th><th>DB</th><th>Time(s)</th><th>State</th><th>Query</th><th>Action</th></tr>
            <?php foreach ($activeQueries as $p): ?>
            <tr>
                <td><?= $p['ID'] ?></td>
                <td><?= htmlspecialchars($p['USER']) ?></td>
                <td><?= htmlspecialchars($p['DB'] ?? '-') ?></td>
                <td><?= $p['TIME'] ?></td>
                <td><?= htmlspecialchars($p['STATE'] ?? '-') ?></td>
                <td title="<?= htmlspecialchars($p['INFO'] ?? '') ?>"><?= htmlspecialchars(substr($p['INFO'] ?? '', 0, 120)) ?></td>
                <td><button class="btn btn-kill" onclick="if(confirm('Kill process <?= $p['ID'] ?>?')) window.location.href='?kill=<?= $p['ID'] ?>'">Kill</button></td>
            </tr>
            <?php endforeach; ?>
        </table>
        <?php else: ?>
        <p class="no-data">ไม่มี active query ตอนนี้</p>
        <?php endif; ?>
    </div>

    <!-- All Connections -->
    <div class="section">
        <h2>📋 All Connections (<?= count($processes) ?>)</h2>
        <table>
            <tr><th>ID</th><th>User</th><th>Host</th><th>DB</th><th>Command</th><th>Time(s)</th><th>State</th><th>Info</th></tr>
            <?php foreach ($processes as $p): ?>
            <tr>
                <td><?= $p['ID'] ?></td>
                <td><?= htmlspecialchars($p['USER']) ?></td>
                <td><?= htmlspecialchars($p['HOST']) ?></td>
                <td><?= htmlspecialchars($p['DB'] ?? '-') ?></td>
                <td><?= htmlspecialchars($p['COMMAND']) ?></td>
                <td><?= $p['TIME'] ?></td>
                <td><?= htmlspecialchars($p['STATE'] ?? '-') ?></td>
                <td title="<?= htmlspecialchars($p['INFO'] ?? '') ?>"><?= htmlspecialchars(substr($p['INFO'] ?? '', 0, 80)) ?></td>
            </tr>
            <?php endforeach; ?>
        </table>
    </div>

    <script>
        // Auto-refresh every 10 seconds
        setTimeout(() => window.location.reload(), 10000);
    </script>
</body>
</html>
