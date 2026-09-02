<?php
/**
 * Auto-Sync: Dump critical order tables from production MySQL
 * and import them into the local standby database.
 *
 * Designed to run via Windows Task Scheduler every 30 minutes
 * during business hours (08:00–13:00, Mon–Sat).
 *
 * Uses the same env/credential infrastructure as scripts/backup/.
 *
 * Usage (CLI only):
 *   php scripts/standby/sync_tables.php
 */
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    die('CLI only');
}

set_time_limit(300); // 5 min max
date_default_timezone_set('Asia/Bangkok');

require_once __DIR__ . DIRECTORY_SEPARATOR . '..' . DIRECTORY_SEPARATOR
    . 'backup' . DIRECTORY_SEPARATOR . 'job.php';

// ─── Configuration ──────────────────────────────────────────────────────────

/** Tables required by batch_process_export.php */
const SYNC_TABLES = [
    'orders',
    'order_items',
    'order_boxes',
    'order_tracking_numbers',
    'customers',
    'products',
    'users',
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function sync_log_dir(string $work): string
{
    return $work . DIRECTORY_SEPARATOR . 'sync';
}

function sync_log_path(string $work): string
{
    return sync_log_dir($work) . DIRECTORY_SEPARATOR . 'sync_log.json';
}

function sync_read_log(string $work): ?array
{
    $path = sync_log_path($work);
    if (!is_file($path)) return null;
    $data = json_decode((string) file_get_contents($path), true);
    return is_array($data) ? $data : null;
}

function sync_write_log(string $work, array $data): void
{
    $dir = sync_log_dir($work);
    if (!is_dir($dir)) mkdir($dir, 0777, true);
    $data['updated_at'] = date('c');
    file_put_contents(
        sync_log_path($work),
        json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT),
        LOCK_EX
    );
}

function sync_log_msg(string $msg): void
{
    $ts = date('H:i:s');
    echo "[$ts] $msg\n";
}

// ─── Main ───────────────────────────────────────────────────────────────────

$env  = backup_env();
$work = backup_workdir($env);
backup_ensure_dirs($work);

// Required binaries & credentials
$mysqldump = $env['MYSQLDUMP'] ?? 'mysqldump';
$mysql     = $env['MYSQL']     ?? 'mysql';
$host      = $env['MYSQL_HOST'] ?? '202.183.192.218';
$port      = $env['MYSQL_PORT'] ?? '3306';
$user      = $env['MYSQL_USER'] ?? 'primacom_mini_erp_backup';
$password  = $env['MYSQL_PASSWORD'] ?? '';
$database  = $env['MYSQL_DATABASE'] ?? 'primacom_mini_erp';

// Local MySQL settings
$localUser = $env['LOCAL_MYSQL_USER'] ?? 'root';
$localPass = $env['LOCAL_MYSQL_PASS'] ?? '12345678';
$localDb   = $env['STANDBY_DB_NAME'] ?? 'standby_erp';

if ($password === '') {
    sync_log_msg('ERROR: MYSQL_PASSWORD is not set in .env');
    sync_write_log($work, [
        'status'     => 'error',
        'error'      => 'MYSQL_PASSWORD not set',
        'started_at' => date('c'),
    ]);
    exit(1);
}

// Validate binaries
foreach (['mysqldump' => $mysqldump, 'mysql' => $mysql] as $name => $bin) {
    if (!is_file($bin)) {
        sync_log_msg("ERROR: $name not found at: $bin");
        sync_write_log($work, [
            'status'     => 'error',
            'error'      => "$name binary not found: $bin",
            'started_at' => date('c'),
        ]);
        exit(1);
    }
}

$tableList = implode(' ', SYNC_TABLES);
$startedAt = date('c');

sync_log_msg("Starting sync of " . count(SYNC_TABLES) . " tables from $host:$port/$database");
sync_write_log($work, [
    'status'     => 'running',
    'tables'     => SYNC_TABLES,
    'started_at' => $startedAt,
    'error'      => null,
]);

// ─── Step 1: Ensure local database exists ───────────────────────────────────

$createDbCmd = sprintf(
    '%s --user=%s --password=%s -e %s 2>&1',
    escapeshellarg($mysql),
    escapeshellarg($localUser),
    escapeshellarg($localPass),
    escapeshellarg("CREATE DATABASE IF NOT EXISTS `$localDb` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
);

exec($createDbCmd, $createOut, $createExit);
if ($createExit !== 0) {
    $err = implode("\n", $createOut);
    sync_log_msg("ERROR creating local database: $err");
    sync_write_log($work, [
        'status'     => 'error',
        'error'      => "Failed to create local DB: $err",
        'started_at' => $startedAt,
    ]);
    exit(1);
}
sync_log_msg("Local database '$localDb' ready");

// ─── Step 2: Dump from production + pipe into local MySQL ───────────────────

$dumpCmd = sprintf(
    '%s --host=%s --port=%s --user=%s '
    . '--single-transaction --quick --skip-lock-tables '
    . '--default-character-set=utf8mb4 --no-tablespaces --force '
    . '%s %s',
    escapeshellarg($mysqldump),
    escapeshellarg($host),
    escapeshellarg($port),
    escapeshellarg($user),
    escapeshellarg($database),
    $tableList
);

$importCmd = sprintf(
    '%s --user=%s --password=%s --force %s',
    escapeshellarg($mysql),
    escapeshellarg($localUser),
    escapeshellarg($localPass),
    escapeshellarg($localDb)
);

$fullCmd = "$dumpCmd 2>&1 | $importCmd 2>&1";

// Set MYSQL_PWD for the dump side (avoids password on command line for mysqldump)
putenv("MYSQL_PWD=$password");

$startTime = microtime(true);

sync_log_msg("Executing: mysqldump → mysql (pipe)...");

$output = [];
exec($fullCmd, $output, $exitCode);

$elapsed = round(microtime(true) - $startTime, 1);

putenv('MYSQL_PWD='); // Clear password from env

if ($exitCode !== 0) {
    $err = implode("\n", $output);
    // If error contains "Got error" or connection failure, server is likely down
    sync_log_msg("ERROR (exit=$exitCode, {$elapsed}s): $err");
    sync_write_log($work, [
        'status'      => 'error',
        'error'       => "Sync failed (exit=$exitCode): " . substr($err, 0, 500),
        'started_at'  => $startedAt,
        'elapsed_sec' => $elapsed,
    ]);
    exit(1);
}

// ─── Step 3: Verify row counts ──────────────────────────────────────────────

sync_log_msg("Sync completed in {$elapsed}s — verifying row counts...");

$counts = [];
foreach (SYNC_TABLES as $table) {
    $countCmd = sprintf(
        '%s --user=%s --password=%s -N -e %s %s 2>&1',
        escapeshellarg($mysql),
        escapeshellarg($localUser),
        escapeshellarg($localPass),
        escapeshellarg("SELECT COUNT(*) FROM `$table`"),
        escapeshellarg($localDb)
    );
    $countOut = [];
    exec($countCmd, $countOut, $countExit);
    $counts[$table] = $countExit === 0 ? (int) trim(implode('', $countOut)) : -1;
    sync_log_msg("  $table: " . ($counts[$table] >= 0 ? number_format($counts[$table]) . " rows" : "ERROR"));
}

// ─── Step 4: Write success log ──────────────────────────────────────────────

sync_write_log($work, [
    'status'      => 'done',
    'tables'      => SYNC_TABLES,
    'row_counts'  => $counts,
    'started_at'  => $startedAt,
    'finished_at' => date('c'),
    'elapsed_sec' => $elapsed,
    'error'       => null,
]);

$totalRows = array_sum(array_filter($counts, fn($v) => $v >= 0));
sync_log_msg("✅ Sync done — $totalRows total rows across " . count(SYNC_TABLES) . " tables ({$elapsed}s)");
