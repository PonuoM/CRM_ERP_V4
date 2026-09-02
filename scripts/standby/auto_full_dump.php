<?php
/**
 * Auto Full Dump: Automated full database backup using mysqldump.
 *
 * Works exactly like clicking "Dump" in the Backup UI, but runs unattended
 * from Windows Task Scheduler. Does NOT upload to Google Drive (manual).
 *
 * Reuses the existing backup infrastructure (job.php, run_job.php)
 * by programmatically creating a job entry and spawning the worker.
 *
 * Usage (CLI only):
 *   php scripts/standby/auto_full_dump.php
 */
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    die('CLI only');
}

set_time_limit(0);
date_default_timezone_set('Asia/Bangkok');

require_once __DIR__ . DIRECTORY_SEPARATOR . '..' . DIRECTORY_SEPARATOR
    . 'backup' . DIRECTORY_SEPARATOR . 'job.php';

// ─── Main ───────────────────────────────────────────────────────────────────

$env  = backup_env();
$work = backup_workdir($env);
backup_ensure_dirs($work);

$ts = date('H:i:s');

// 1. Check prerequisites
$mysqldump = $env['MYSQLDUMP'] ?? 'C:\\xampp\\mysql\\bin\\mysqldump.exe';
$gzip      = $env['GZIP'] ?? 'C:\\Program Files\\Git\\usr\\bin\\gzip.exe';
$password  = $env['MYSQL_PASSWORD'] ?? '';

if ($password === '') {
    echo "[$ts] ERROR: MYSQL_PASSWORD is not set in .env\n";
    exit(1);
}
if (!is_file($mysqldump)) {
    echo "[$ts] ERROR: mysqldump not found at: $mysqldump\n";
    exit(1);
}
if (!is_file($gzip)) {
    echo "[$ts] ERROR: gzip not found at: $gzip\n";
    exit(1);
}

// 2. Check if a job is already running (prevent concurrent dumps)
$existingJob = backup_job_read($work);
if (backup_job_is_busy($existingJob)) {
    echo "[$ts] SKIP: Another backup job is already running\n";
    exit(0);
}

// 3. Create job entry (same format as api.php action=dump)
$db    = $env['MYSQL_DATABASE'] ?? 'primacom_mini_erp';
$stamp = date('Ymd_His');
$file  = $db . '_' . $stamp . '.sql.gz';
$prev  = backup_prev_dump_bytes($work, $file);

$job = backup_job_new('dump', $file, $prev);
backup_job_write($work, $job);

echo "[$ts] Starting auto full dump: $file\n";
echo "[$ts] Previous dump size: " . ($prev ? round($prev / 1048576, 1) . ' MB' : 'unknown') . "\n";

// 4. Spawn the worker (same as api.php action=dump)
// This uses the existing run_job.php which handles the actual mysqldump
backup_spawn_worker('dump');

echo "[$ts] Worker spawned — dump running in background\n";
echo "[$ts] Output file: $work" . DIRECTORY_SEPARATOR . "$file\n";
echo "[$ts] Monitor progress in Backup UI (http://127.0.0.1:8787/) or check:\n";
echo "[$ts]   $work" . DIRECTORY_SEPARATOR . "jobs" . DIRECTORY_SEPARATOR . "current.json\n";

// 5. Optionally wait for completion (for Task Scheduler logging)
$maxWait = 1200; // 20 minutes max
$waited  = 0;
$pollInterval = 5; // check every 5 seconds

while ($waited < $maxWait) {
    sleep($pollInterval);
    $waited += $pollInterval;

    $job = backup_job_read($work);
    if (!$job) break;

    $status = $job['status'] ?? '';
    if ($status === 'done') {
        $bytes = $job['bytes'] ?? 0;
        $mb = round($bytes / 1048576, 1);
        echo "[" . date('H:i:s') . "] ✅ Dump completed: {$mb} MB ({$waited}s)\n";
        exit(0);
    }
    if ($status === 'error') {
        $err = $job['error'] ?? 'Unknown error';
        echo "[" . date('H:i:s') . "] ❌ Dump failed: $err\n";
        exit(1);
    }

    // Still running — show progress
    $percent = $job['percent'] ?? null;
    $bytes   = $job['bytes'] ?? 0;
    if ($waited % 30 === 0) { // Log every 30 seconds
        $mb = round($bytes / 1048576, 1);
        $pct = $percent !== null ? round($percent, 1) . '%' : '...';
        echo "[" . date('H:i:s') . "] Dumping... {$mb} MB ($pct)\n";
    }
}

echo "[" . date('H:i:s') . "] ⚠️ Timeout after {$maxWait}s — dump may still be running in background\n";
exit(0);
