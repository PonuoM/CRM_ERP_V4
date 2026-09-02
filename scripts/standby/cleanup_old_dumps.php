<?php
/**
 * GFS Rotation Cleanup for local .sql.gz dump files.
 *
 * Policy:
 *   - Daily backups:   keep for 30 days
 *   - Monthly backups: keep first-of-month (day 1–3) for 6 months (180 days)
 *   - Safety net:      always keep at least 3 most recent files regardless
 *
 * Designed to run via Windows Task Scheduler daily at 02:00.
 *
 * Usage (CLI only):
 *   php scripts/standby/cleanup_old_dumps.php
 *   php scripts/standby/cleanup_old_dumps.php --dry-run
 */
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    die('CLI only');
}

date_default_timezone_set('Asia/Bangkok');

require_once __DIR__ . DIRECTORY_SEPARATOR . '..' . DIRECTORY_SEPARATOR
    . 'backup' . DIRECTORY_SEPARATOR . 'job.php';

// ─── Configuration ──────────────────────────────────────────────────────────

const DAILY_KEEP_DAYS   = 30;
const MONTHLY_KEEP_DAYS = 180;  // 6 months
const MIN_KEEP_FILES    = 3;    // Safety net: never delete below this count

// ─── Main ───────────────────────────────────────────────────────────────────

$dryRun = in_array('--dry-run', $argv ?? [], true);
if ($dryRun) {
    echo "=== DRY-RUN MODE (no files will be deleted) ===\n\n";
}

$env  = backup_env();
$work = backup_workdir($env);

// 1. Scan all .sql.gz files
$pattern = $work . DIRECTORY_SEPARATOR . '*.sql.gz';
$files   = glob($pattern);

if (!$files || count($files) === 0) {
    echo "No dump files found in: $work\n";
    exit(0);
}

// 2. Sort by modification time (newest first)
usort($files, fn($a, $b) => filemtime($b) - filemtime($a));

$now       = time();
$deleted   = 0;
$kept      = 0;
$logLines  = [];
$totalFreed = 0;

echo sprintf("Found %d dump file(s) in: %s\n\n", count($files), $work);

foreach ($files as $i => $file) {
    $basename = basename($file);
    $mtime    = filemtime($file);
    $ageDays  = ($now - $mtime) / 86400;
    $sizeMB   = round(filesize($file) / 1048576, 1);

    // Safety net: always keep the N most recent files
    if ($i < MIN_KEEP_FILES) {
        $kept++;
        $logLines[] = "[KEEP-SAFETY] $basename (rank #" . ($i + 1) . ", {$sizeMB}MB, " . round($ageDays) . "d old)";
        echo "  🔒 KEEP (safety) $basename — rank #" . ($i + 1) . "\n";
        continue;
    }

    // Extract date from filename: primacom_mini_erp_YYYYMMDD_HHMMSS.sql.gz
    $isMonthly = false;
    if (preg_match('/(\d{4})(\d{2})(\d{2})_/', $basename, $m)) {
        $day = (int) $m[3];
        // Consider day 1–3 as "first of month" (backup might not run exactly on the 1st)
        $isMonthly = ($day >= 1 && $day <= 3);
    }

    $type   = $isMonthly ? 'monthly' : 'daily';
    $maxAge = $isMonthly ? MONTHLY_KEEP_DAYS : DAILY_KEEP_DAYS;

    if ($ageDays > $maxAge) {
        if (!$dryRun) {
            @unlink($file);
        }
        $deleted++;
        $totalFreed += $sizeMB;
        $logLines[] = "[DELETED] $basename (age: " . round($ageDays) . "d, size: {$sizeMB}MB, type: $type)";
        echo "  🗑️  " . ($dryRun ? 'WOULD DELETE' : 'DELETED') . " $basename — {$sizeMB}MB, " . round($ageDays) . "d old ($type)\n";
    } else {
        $kept++;
        $logLines[] = "[KEEP] $basename (age: " . round($ageDays) . "d, type: $type, max: {$maxAge}d)";
        echo "  ✅ KEEP $basename — " . round($ageDays) . "d old ($type, limit: {$maxAge}d)\n";
    }
}

// 3. Write cleanup log
$logDir  = $work . DIRECTORY_SEPARATOR . 'cleanup_logs';
if (!is_dir($logDir)) {
    mkdir($logDir, 0777, true);
}
$logFile = $logDir . DIRECTORY_SEPARATOR . 'cleanup_' . date('Ymd') . '.log';

$summary = sprintf(
    "[%s] GFS Cleanup%s: %d deleted (%.1f MB freed), %d kept\n",
    date('Y-m-d H:i:s'),
    $dryRun ? ' (DRY-RUN)' : '',
    $deleted,
    $totalFreed,
    $kept
);

file_put_contents($logFile, $summary . implode("\n", $logLines) . "\n", FILE_APPEND | LOCK_EX);

echo "\n" . $summary;
echo "Log written to: $logFile\n";
