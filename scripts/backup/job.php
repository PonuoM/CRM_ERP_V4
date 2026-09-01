<?php
/**
 * Shared job helpers for the office-only backup UI.
 * DO NOT deploy under public_html.
 */
declare(strict_types=1);

require_once dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'api' . DIRECTORY_SEPARATOR . 'env_file.php';

function backup_env(): array
{
    $root = dirname(__DIR__, 2);
    $fromFiles = erp_merge_env_files([
        $root . DIRECTORY_SEPARATOR . '.env',
        $root . DIRECTORY_SEPARATOR . '.env.local',
        $root . DIRECTORY_SEPARATOR . 'api' . DIRECTORY_SEPARATOR . '.env',
        __DIR__ . DIRECTORY_SEPARATOR . '.env',
    ]);
    $out = erp_env_overlay_getenv($fromFiles);
    foreach ([
        'MYSQL_HOST', 'MYSQL_PORT', 'MYSQL_USER', 'MYSQL_PASSWORD', 'MYSQL_DATABASE',
        'MYSQLDUMP', 'MYSQL', 'GZIP', 'WORKDIR', 'RCLONE_DEST', 'KEEP_LOCAL', 'RCLONE',
    ] as $k) {
        $g = getenv($k);
        if (is_string($g) && trim($g) !== '') {
            $out[$k] = trim($g);
        }
    }
    return $out;
}

function backup_workdir(array $env): string
{
    $work = $env['WORKDIR'] ?? (getenv('USERPROFILE') . '\\Documents\\prima_db_backups');
    return (string) $work;
}

function backup_jobs_dir(string $work): string
{
    return $work . DIRECTORY_SEPARATOR . 'jobs';
}

function backup_job_path(string $work): string
{
    return backup_jobs_dir($work) . DIRECTORY_SEPARATOR . 'current.json';
}

function backup_ensure_dirs(string $work): void
{
    if (!is_dir($work)) {
        mkdir($work, 0777, true);
    }
    $jobs = backup_jobs_dir($work);
    if (!is_dir($jobs)) {
        mkdir($jobs, 0777, true);
    }
}

function backup_job_read(string $work): ?array
{
    $path = backup_job_path($work);
    if (!is_file($path)) {
        return null;
    }
    $raw = (string) file_get_contents($path);
    $data = json_decode($raw, true);
    return is_array($data) ? $data : null;
}

function backup_job_write(string $work, array $data): void
{
    $data['updated_at'] = date('c');
    $path = backup_job_path($work);
    file_put_contents(
        $path,
        json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT),
        LOCK_EX
    );
}

function backup_job_new(string $type, string $file, ?int $totalBytes): array
{
    return [
        'id' => date('Ymd_His'),
        'type' => $type,
        'status' => 'running',
        'phase' => $type === 'upload' ? 'upload' : 'dump',
        'file' => $file,
        'bytes' => 0,
        'total_bytes' => $totalBytes,
        'percent' => null,
        'speed' => null,
        'eta' => null,
        'log' => '',
        'error' => null,
        'started_at' => date('c'),
        'updated_at' => date('c'),
        'pid' => 0,
        'exit' => null,
    ];
}

function backup_pid_alive(int $pid): bool
{
    if ($pid <= 0) {
        return false;
    }
    if (strncasecmp(PHP_OS, 'WIN', 3) === 0) {
        $out = [];
        exec('tasklist /FI "PID eq ' . $pid . '" /NH 2>NUL', $out);
        $line = strtolower(implode(' ', $out));
        if (str_contains($line, 'no tasks are running')) {
            return false;
        }
        if ($line === '') {
            return true;
        }
        return str_contains($line, (string) $pid);
    }
    if (function_exists('posix_kill')) {
        return @posix_kill($pid, 0);
    }
    return false;
}

function backup_job_is_busy(?array $job): bool
{
    if (!$job || ($job['status'] ?? '') !== 'running') {
        return false;
    }
    $pid = (int) ($job['pid'] ?? 0);
    if (backup_pid_alive($pid)) {
        return true;
    }
    $started = strtotime((string) ($job['started_at'] ?? '')) ?: 0;
    // Worker has not written its pid yet (Start-Process window).
    if ($pid === 0 && $started > 0 && (time() - $started) < 20) {
        return true;
    }
    return false;
}

function backup_job_reconcile(string $work, ?array $job): ?array
{
    if (!$job) {
        return null;
    }
    if (($job['status'] ?? '') !== 'running') {
        return $job;
    }
    if (backup_job_is_busy($job)) {
        return $job;
    }
    $job['status'] = 'error';
    $job['phase'] = 'error';
    $job['error'] = $job['error'] ?: 'งานหยุดก่อนเสร็จ (โปรเซสไม่ทำงานแล้ว)';
    backup_job_write($work, $job);
    return $job;
}

function backup_prev_dump_bytes(string $work, string $excludeName = ''): ?int
{
    $best = 0;
    foreach (glob($work . DIRECTORY_SEPARATOR . '*.sql.gz') ?: [] as $f) {
        if ($excludeName !== '' && basename($f) === $excludeName) {
            continue;
        }
        $size = (int) filesize($f);
        if ($size > $best) {
            $best = $size;
        }
    }
    return $best > 1000 ? $best : null;
}

function backup_tail_file(string $path, int $max = 2000): string
{
    if (!is_file($path)) {
        return '';
    }
    $raw = (string) file_get_contents($path);
    if (strlen($raw) <= $max) {
        return $raw;
    }
    return substr($raw, -$max);
}

function backup_ps_quote(string $s): string
{
    return "'" . str_replace("'", "''", $s) . "'";
}

/**
 * Quote a Windows CreateProcess argument only when needed.
 * Never quote rclone remotes like gdrive: — cmd treats "gdrive:" as a volume label
 * and fails with "The filename, directory name, or volume label syntax is incorrect."
 */
function backup_win_quote_arg(string $s): string
{
    if ($s === '') {
        return '""';
    }
    if (!preg_match('/[\s"]/', $s)) {
        return $s;
    }
    return '"' . str_replace('"', '\\"', $s) . '"';
}

function backup_win_cmdline(string $exe, array $args): string
{
    $cmd = backup_win_quote_arg($exe);
    foreach ($args as $a) {
        $cmd .= ' ' . backup_win_quote_arg((string) $a);
    }
    return $cmd;
}

function backup_spawn_worker(string $kind, string $file = ''): void
{
    $php = PHP_BINARY;
    $script = __DIR__ . DIRECTORY_SEPARATOR . 'run_job.php';
    $args = [$script, $kind];
    if ($file !== '') {
        $args[] = $file;
    }
    $env = backup_env();
    $work = backup_workdir($env);
    backup_ensure_dirs($work);
    $psPath = backup_jobs_dir($work) . DIRECTORY_SEPARATOR . 'spawn.ps1';
    $ps = 'Start-Process -FilePath ' . backup_ps_quote($php)
        . ' -ArgumentList @(' . implode(', ', array_map('backup_ps_quote', $args)) . ')'
        . " -WindowStyle Hidden\r\n";
    file_put_contents($psPath, $ps);
    pclose(popen('powershell -NoProfile -WindowStyle Hidden -File ' . escapeshellarg($psPath), 'r'));
}

function backup_parse_size_to_bytes(string $s): ?int
{
    if (!preg_match('/([\d.]+)\s*(B|KiB|MiB|GiB|TiB|KB|MB|GB|TB)/i', $s, $m)) {
        return null;
    }
    $n = (float) $m[1];
    $u = strtolower($m[2]);
    $mult = [
        'b' => 1,
        'kib' => 1024,
        'mib' => 1024 ** 2,
        'gib' => 1024 ** 3,
        'tib' => 1024 ** 4,
        'kb' => 1000,
        'mb' => 1000 ** 2,
        'gb' => 1000 ** 3,
        'tb' => 1000 ** 4,
    ];
    return (int) round($n * ($mult[$u] ?? 1));
}

function backup_parse_rclone_stats(string $text): array
{
    $text = str_replace("\r", "\n", $text);
    $out = [
        'bytes' => null,
        'total_bytes' => null,
        'percent' => null,
        'speed' => null,
        'eta' => null,
    ];
    // --stats-one-line has no "Transferred:" prefix: "123.4 MiB / 470.8 MiB, 26%, 5.2 MiB/s, ETA 1m"
    $pattern = '/([\d.]+\s*(?:[KMGT]i?B|B))\s*\/\s*([\d.]+\s*(?:[KMGT]i?B|B)),\s*(?:([\d.]+)%|-)\s*,\s*([^,\n]+?)(?:,\s*ETA\s+(\S+))?/i';
    if (!preg_match_all($pattern, $text, $matches, PREG_SET_ORDER)) {
        return $out;
    }
    $chosen = null;
    foreach ($matches as $m) {
        $total = backup_parse_size_to_bytes($m[2]);
        if ($total !== null && $total > 0) {
            $chosen = $m;
        } elseif ($chosen === null) {
            $chosen = $m;
        }
    }
    if ($chosen === null) {
        return $out;
    }
    $out['bytes'] = backup_parse_size_to_bytes($chosen[1]);
    $out['total_bytes'] = backup_parse_size_to_bytes($chosen[2]);
    $out['percent'] = isset($chosen[3]) && $chosen[3] !== '' ? (float) $chosen[3] : null;
    $out['speed'] = trim($chosen[4] ?? '');
    $out['eta'] = isset($chosen[5]) ? trim($chosen[5]) : null;
    if (($out['total_bytes'] ?? 0) <= 0) {
        $out['percent'] = null;
    }
    return $out;
}

function backup_rclone_skipped(string $text): bool
{
    return (bool) preg_match('/Unchanged skipping|Skipped copy/i', $text);
}

function backup_rclone_copied(string $text): bool
{
    return (bool) preg_match('/Copied \(new\)|Copied \(replaced/i', $text);
}

function backup_last_log(string $text, int $max = 2000): string
{
    $text = str_replace("\r", "\n", $text);
    $text = trim($text);
    if (strlen($text) <= $max) {
        return $text;
    }
    return substr($text, -$max);
}
