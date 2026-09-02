<?php
/**
 * CLI worker for office dump / rclone upload. Updates WORKDIR/jobs/current.json.
 * DO NOT deploy under public_html. Not a web endpoint.
 */
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'cli only';
    exit(1);
}

require_once __DIR__ . DIRECTORY_SEPARATOR . 'job.php';

set_time_limit(0);
ignore_user_abort(true);

$kind = $argv[1] ?? '';
$fileArg = $argv[2] ?? '';

$env = backup_env();
$work = backup_workdir($env);
backup_ensure_dirs($work);

$job = backup_job_read($work);
if (!$job || ($job['status'] ?? '') !== 'running') {
    fwrite(STDERR, "no running job\n");
    exit(1);
}

$job['pid'] = getmypid();
backup_job_write($work, $job);

if ($kind === 'dump') {
    if (($job['type'] ?? '') !== 'dump') {
        fwrite(STDERR, "job type is not dump\n");
        exit(1);
    }
    backup_run_dump($env, $work, $job);
    exit(0);
}
if ($kind === 'upload') {
    if (($job['type'] ?? '') !== 'upload') {
        fwrite(STDERR, "job type is not upload\n");
        exit(1);
    }
    backup_run_upload($env, $work, $job, $fileArg);
    exit(0);
}

$job['status'] = 'error';
$job['phase'] = 'error';
$job['error'] = 'unknown worker kind';
backup_job_write($work, $job);
exit(1);

function backup_run_dump(array $env, string $work, array $job): void
{
    $mysqldump = $env['MYSQLDUMP'] ?? 'C:\\xampp\\mysql\\bin\\mysqldump.exe';
    $gzip = $env['GZIP'] ?? 'C:\\Program Files\\Git\\usr\\bin\\gzip.exe';
    $file = (string) ($job['file'] ?? '');
    if ($file === '' || !preg_match('/^[\w.-]+\.sql\.gz$/', $file)) {
        $job['status'] = 'error';
        $job['phase'] = 'error';
        $job['error'] = 'ชื่อไฟล์ dump ไม่ถูกต้อง';
        backup_job_write($work, $job);
        return;
    }
    if (!is_file($mysqldump) || !is_file($gzip)) {
        $job['status'] = 'error';
        $job['phase'] = 'error';
        $job['error'] = 'ไม่พบ mysqldump หรือ gzip';
        backup_job_write($work, $job);
        return;
    }
    if (($env['MYSQL_PASSWORD'] ?? '') === '') {
        $job['status'] = 'error';
        $job['phase'] = 'error';
        $job['error'] = 'ใส่ MYSQL_PASSWORD ใน .env';
        backup_job_write($work, $job);
        return;
    }

    $stamp = $job['id'] ?? date('Ymd_His');
    $gzPath = $work . DIRECTORY_SEPARATOR . $file;
    $errPath = $work . DIRECTORY_SEPARATOR . 'dump_' . $stamp . '.err';
    $db = $env['MYSQL_DATABASE'] ?? 'primacom_mini_erp';
    $cmd = sprintf(
        '"%s" --host=%s --port=%s --user=%s --single-transaction --quick --skip-lock-tables --routines --triggers --events --hex-blob --default-character-set=utf8mb4 --no-tablespaces --force --ignore-table=%s.v_customer_buckets %s 2> "%s" | "%s" -1 > "%s"',
        $mysqldump,
        $env['MYSQL_HOST'] ?? '202.183.192.218',
        $env['MYSQL_PORT'] ?? '3306',
        $env['MYSQL_USER'] ?? 'primacom_mini_erp_backup',
        $db,
        $db,
        $errPath,
        $gzip,
        $gzPath
    );

    putenv('MYSQL_PWD=' . ($env['MYSQL_PASSWORD'] ?? ''));
    $proc = proc_open('cmd /c ' . $cmd, [
        0 => ['pipe', 'r'],
        1 => ['pipe', 'w'],
        2 => ['pipe', 'w'],
    ], $pipes);
    if (is_array($pipes) && isset($pipes[0]) && is_resource($pipes[0])) {
        fclose($pipes[0]);
    }
    if (!is_resource($proc)) {
        putenv('MYSQL_PWD');
        $job['status'] = 'error';
        $job['phase'] = 'error';
        $job['error'] = 'ไม่สามารถเริ่ม mysqldump ได้';
        backup_job_write($work, $job);
        return;
    }

    $exit = 1;
    while (true) {
        $st = proc_get_status($proc);
        backup_job_touch_dump($work, $job, $gzPath, $errPath, null);
        $job = backup_job_read($work) ?? $job;
        if (empty($st['running'])) {
            $exit = (int) ($st['exitcode'] ?? 1);
            break;
        }
        usleep(400000);
    }
    foreach ($pipes as $p) {
        if (is_resource($p)) {
            fclose($p);
        }
    }
    proc_close($proc);
    putenv('MYSQL_PWD');

    clearstatcache(true, $gzPath);
    $okFile = is_file($gzPath) && filesize($gzPath) > 1000;
    $err = backup_tail_file($errPath, 2000);
    $job = backup_job_read($work) ?? $job;
    $job['bytes'] = $okFile ? (int) filesize($gzPath) : (int) ($job['bytes'] ?? 0);
    $job['exit'] = $exit;
    $job['log'] = $err;
    if ($exit === 0 && $okFile) {
        $job['status'] = 'done';
        $job['phase'] = 'done';
        $job['percent'] = 100;
        $job['error'] = null;
        $job['log'] = trim($err . "\nDump เสร็จ " . basename($gzPath) . ' (' . backup_fmt_mb($job['bytes']) . ')');
    } else {
        $job['status'] = 'error';
        $job['phase'] = 'error';
        $job['error'] = $err !== '' ? $err : ('dump ล้มเหลว exit=' . $exit);
        $job['percent'] = null;
    }
    backup_job_write($work, $job);
}

function backup_job_touch_dump(string $work, array $job, string $gzPath, string $errPath, ?int $exit): void
{
    clearstatcache(true, $gzPath);
    $bytes = is_file($gzPath) ? (int) filesize($gzPath) : 0;
    $total = isset($job['total_bytes']) ? (int) $job['total_bytes'] : 0;
    $percent = null;
    if ($total > 0 && $bytes > 0) {
        $percent = min(99.0, round($bytes / $total * 100, 1));
    }
    $job['status'] = 'running';
    $job['bytes'] = $bytes;
    $job['percent'] = $percent;
    $job['phase'] = 'dump';
    $job['log'] = 'กำลัง dump — ไฟล์ ' . backup_fmt_mb($bytes)
        . ($total > 0 ? ' / ประมาณ ' . backup_fmt_mb($total) : '')
        . "\n" . backup_tail_file($errPath, 1200);
    if ($exit !== null) {
        $job['exit'] = $exit;
    }
    backup_job_write($work, $job);
}

function backup_fmt_mb(int $bytes): string
{
    return round($bytes / 1048576, 1) . ' MB';
}

function backup_run_upload(array $env, string $work, array $job, string $fileArg): void
{
    $dest = trim((string) ($env['RCLONE_DEST'] ?? ''));
    $file = basename($fileArg !== '' ? $fileArg : (string) ($job['file'] ?? ''));
    if ($dest === '') {
        $job['status'] = 'error';
        $job['phase'] = 'error';
        $job['error'] = 'ตั้ง RCLONE_DEST ใน .env';
        backup_job_write($work, $job);
        return;
    }
    if ($file === '' || !preg_match('/^[\w.-]+\.sql\.gz$/', $file)) {
        $job['status'] = 'error';
        $job['phase'] = 'error';
        $job['error'] = 'ชื่อไฟล์ไม่ถูกต้อง';
        backup_job_write($work, $job);
        return;
    }
    $full = $work . DIRECTORY_SEPARATOR . $file;
    if (!is_file($full)) {
        $job['status'] = 'error';
        $job['phase'] = 'error';
        $job['error'] = 'ไม่พบไฟล์';
        backup_job_write($work, $job);
        return;
    }

    $rcloneBin = trim((string) ($env['RCLONE'] ?? ''));
    if ($rcloneBin === '') {
        $rcloneBin = 'rclone';
    }
    if ($rcloneBin !== 'rclone' && !is_file($rcloneBin)) {
        $job['status'] = 'error';
        $job['phase'] = 'error';
        $job['error'] = 'ไม่พบ rclone ตาม RCLONE ใน .env';
        backup_job_write($work, $job);
        return;
    }

    $logPath = backup_jobs_dir($work) . DIRECTORY_SEPARATOR . 'rclone.log';
    @unlink($logPath);
    $cmd = backup_win_cmdline($rcloneBin, [
        'copy',
        $full,
        $dest,
        '--stats',
        '1s',
        '--stats-one-line',
        '--log-file',
        $logPath,
        '--log-level',
        'INFO',
        '--stats-log-level',
        'INFO',
    ]);

    $job['phase'] = 'upload';
    $job['total_bytes'] = (int) filesize($full);
    $job['bytes'] = 0;
    $job['log'] = 'กำลังอัป Drive…';
    backup_job_write($work, $job);

    $nul = strncasecmp(PHP_OS, 'WIN', 3) === 0 ? 'NUL' : '/dev/null';
    $procOpts = strncasecmp(PHP_OS, 'WIN', 3) === 0 ? ['bypass_shell' => true] : [];
    $pipes = [];
    $proc = proc_open($cmd, [
        0 => ['file', $nul, 'r'],
        1 => ['file', $nul, 'w'],
        2 => ['file', $nul, 'w'],
    ], $pipes, null, null, $procOpts);
    if (!is_resource($proc)) {
        $job['status'] = 'error';
        $job['phase'] = 'error';
        $job['error'] = 'ไม่สามารถเริ่ม rclone ได้';
        backup_job_write($work, $job);
        return;
    }

    $started = time();
    $exit = 1;
    while (true) {
        $buf = is_file($logPath) ? (string) @file_get_contents($logPath) : '';
        $stats = backup_parse_rclone_stats($buf);
        $elapsed = max(0, time() - $started);
        $job['bytes'] = $stats['bytes'] ?? $job['bytes'];
        if ($stats['total_bytes']) {
            $job['total_bytes'] = $stats['total_bytes'];
        }
        $job['status'] = 'running';
        $job['percent'] = $stats['percent'];
        $job['speed'] = $stats['speed'];
        $job['eta'] = $stats['eta'];
        $job['skipped'] = backup_rclone_skipped($buf);
        $job['copied'] = backup_rclone_copied($buf);
        $job['phase'] = 'upload';
        if ($buf === '') {
            $job['log'] = 'กำลังอัป Drive… ' . $elapsed . ' วินาที';
        } elseif (($job['bytes'] ?? 0) <= 0 && !$job['skipped'] && !$job['copied']) {
            $job['log'] = "กำลังเช็คว่ามีบน Drive แล้วหรือยัง… ({$elapsed} วินาที)\n" . backup_last_log($buf, 1600);
        } else {
            $job['log'] = backup_last_log($buf, 2000);
        }
        backup_job_write($work, $job);

        $st = proc_get_status($proc);
        if (empty($st['running'])) {
            $exit = (int) ($st['exitcode'] ?? 1);
            break;
        }
        usleep(400000);
    }
    proc_close($proc);
    $buf = is_file($logPath) ? (string) @file_get_contents($logPath) : '';

    $job = backup_job_read($work) ?? $job;
    $job['exit'] = $exit;
    $job['log'] = backup_last_log($buf, 2000);
    if ($exit === 0) {
        $keep = (int) ($env['KEEP_LOCAL'] ?? 0);
        $deleted = false;
        if ($keep === 0) {
            $deleted = @unlink($full);
        }
        $skipped = backup_rclone_skipped($buf) || (!backup_rclone_copied($buf) && (int) ($job['bytes'] ?? 0) <= 0);
        $job['skipped'] = $skipped;
        $job['copied'] = backup_rclone_copied($buf);
        $job['status'] = 'done';
        $job['phase'] = 'done';
        $job['percent'] = 100;
        $job['error'] = null;
        if ($skipped) {
            $job['log'] = trim($job['log'] . "\nมีไฟล์นี้บน Drive แล้ว — ไม่ได้อัปซ้ำ");
        } else {
            $job['log'] = trim($job['log'] . "\nอัป Drive เสร็จ" . ($deleted ? ' — ลบไฟล์ท้องถิ่นแล้ว' : ''));
        }
    } else {
        $job['status'] = 'error';
        $job['phase'] = 'error';
        $job['error'] = $job['log'] !== '' ? $job['log'] : ('rclone ล้มเหลว exit=' . $exit);
    }
    backup_job_write($work, $job);
}
