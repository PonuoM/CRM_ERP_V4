<?php
/**
 * Office-only backup helper. DO NOT deploy under public_html.
 * Bind to 127.0.0.1 only: php -S 127.0.0.1:8787 -t scripts/backup
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

$remote = $_SERVER['REMOTE_ADDR'] ?? '';
if (!in_array($remote, ['127.0.0.1', '::1'], true)) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'message' => 'localhost only']);
    exit;
}

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

function backup_json($data, int $code = 200): void
{
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

$env = backup_env();
$action = $_GET['action'] ?? $_POST['action'] ?? 'status';
$work = $env['WORKDIR'] ?? (getenv('USERPROFILE') . '\\Documents\\prima_db_backups');

if ($action === 'status') {
    $files = [];
    if (is_dir($work)) {
        foreach (glob($work . DIRECTORY_SEPARATOR . '*.sql.gz') ?: [] as $f) {
            $files[] = [
                'name' => basename($f),
                'size' => filesize($f),
                'mtime' => date('c', filemtime($f)),
            ];
        }
    }
    usort($files, fn($a, $b) => strcmp($b['mtime'], $a['mtime']));
    backup_json([
        'ok' => true,
        'workdir' => $work,
        'env_present' => is_readable(dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . '.env')
            || is_readable(__DIR__ . DIRECTORY_SEPARATOR . '.env'),
        'rclone_dest' => $env['RCLONE_DEST'] ?? '',
        'files' => $files,
        'hint' => 'กด Dump แล้วอัป Drive จากเครื่องนี้เท่านั้น ห้ามวางสคริปต์นี้บนโฮสต์',
    ]);
}

if ($action === 'dump') {
    $mysqldump = $env['MYSQLDUMP'] ?? 'C:\\xampp\\mysql\\bin\\mysqldump.exe';
    $gzip = $env['GZIP'] ?? 'C:\\Program Files\\Git\\usr\\bin\\gzip.exe';
    if (!is_file($mysqldump) || !is_file($gzip)) {
        backup_json(['ok' => false, 'message' => 'ไม่พบ mysqldump หรือ gzip'], 500);
    }
    if (($env['MYSQL_PASSWORD'] ?? '') === '') {
        backup_json(['ok' => false, 'message' => 'ใส่ MYSQL_PASSWORD ใน .env ที่รากโปรเจกต์ (หรือ overlay ที่ scripts/backup/.env)'], 400);
    }
    if (!is_dir($work)) {
        mkdir($work, 0777, true);
    }
    $stamp = date('Ymd_His');
    $gzPath = $work . DIRECTORY_SEPARATOR . 'primacom_mini_erp_' . $stamp . '.sql.gz';
    $errPath = $work . DIRECTORY_SEPARATOR . 'dump_' . $stamp . '.err';
    $cmd = sprintf(
        '"%s" --host=%s --port=%s --user=%s --single-transaction --quick --skip-lock-tables --routines --triggers --events --hex-blob --default-character-set=utf8mb4 --no-tablespaces --force --ignore-table=%s.v_customer_buckets %s 2> "%s" | "%s" -1 > "%s"',
        $mysqldump,
        $env['MYSQL_HOST'] ?? '202.183.192.218',
        $env['MYSQL_PORT'] ?? '3306',
        $env['MYSQL_USER'] ?? 'primacom_mini_erp_backup',
        $env['MYSQL_DATABASE'] ?? 'primacom_mini_erp',
        $env['MYSQL_DATABASE'] ?? 'primacom_mini_erp',
        $errPath,
        $gzip,
        $gzPath
    );
    putenv('MYSQL_PWD=' . ($env['MYSQL_PASSWORD'] ?? ''));
    $code = 0;
    system('cmd /c ' . $cmd, $code);
    putenv('MYSQL_PWD');
    $err = is_file($errPath) ? (string) file_get_contents($errPath) : '';
    $okFile = is_file($gzPath) && filesize($gzPath) > 1000;
    backup_json([
        'ok' => $code === 0 && $okFile,
        'file' => $okFile ? basename($gzPath) : null,
        'size' => $okFile ? filesize($gzPath) : 0,
        'stderr' => mb_substr($err, 0, 2000),
        'exit' => $code,
        'note' => 'ตรวจท้ายไฟล์ว่ามี Dump completed ก่อนลบของท้องถิ่น — อัป Drive ด้วยปุ่ม Upload',
    ]);
}

if ($action === 'upload') {
    $dest = trim($env['RCLONE_DEST'] ?? '');
    $file = basename((string) ($_POST['file'] ?? $_GET['file'] ?? ''));
    if ($dest === '') {
        backup_json(['ok' => false, 'message' => 'ตั้ง RCLONE_DEST ใน .env ที่รากโปรเจกต์ หลัง rclone config หรืออัปด้วยมือบน Drive'], 400);
    }
    if ($file === '' || !preg_match('/^[\w.-]+\.sql\.gz$/', $file)) {
        backup_json(['ok' => false, 'message' => 'ชื่อไฟล์ไม่ถูกต้อง'], 400);
    }
    $full = $work . DIRECTORY_SEPARATOR . $file;
    if (!is_file($full)) {
        backup_json(['ok' => false, 'message' => 'ไม่พบไฟล์'], 404);
    }
    $rcloneBin = trim((string) ($env['RCLONE'] ?? ''));
    if ($rcloneBin === '') {
        $rcloneBin = 'rclone';
    }
    if ($rcloneBin !== 'rclone' && !is_file($rcloneBin)) {
        backup_json(['ok' => false, 'message' => 'ไม่พบ rclone ตาม RCLONE ใน .env'], 500);
    }
    $rcloneCmd = ($rcloneBin === 'rclone') ? 'rclone' : ('"' . $rcloneBin . '"');
    $cmd = sprintf('%s copy "%s" "%s" --progress', $rcloneCmd, $full, $dest);
    $out = [];
    $code = 0;
    exec($cmd . ' 2>&1', $out, $code);
    $keep = (int) ($env['KEEP_LOCAL'] ?? 0);
    if ($code === 0 && $keep === 0) {
        @unlink($full);
    }
    backup_json([
        'ok' => $code === 0,
        'exit' => $code,
        'output' => mb_substr(implode("\n", $out), 0, 2000),
        'deleted_local' => $code === 0 && $keep === 0,
    ]);
}

backup_json(['ok' => false, 'message' => 'unknown action'], 400);
