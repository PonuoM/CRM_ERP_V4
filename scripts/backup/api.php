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

require_once __DIR__ . DIRECTORY_SEPARATOR . 'job.php';

function backup_json($data, int $code = 200): void
{
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

$env = backup_env();
$action = $_GET['action'] ?? $_POST['action'] ?? 'status';
$work = backup_workdir($env);
backup_ensure_dirs($work);

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
    $job = backup_job_reconcile($work, backup_job_read($work));
    backup_json([
        'ok' => true,
        'workdir' => $work,
        'env_present' => is_readable(dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . '.env')
            || is_readable(__DIR__ . DIRECTORY_SEPARATOR . '.env'),
        'rclone_dest' => $env['RCLONE_DEST'] ?? '',
        'files' => $files,
        'job' => $job,
        'busy' => backup_job_is_busy($job),
        'hint' => 'กด Dump แล้วอัป Drive จากเครื่องนี้เท่านั้น ห้ามวางสคริปต์นี้บนโฮสต์',
    ]);
}

if ($action === 'job') {
    $job = backup_job_reconcile($work, backup_job_read($work));
    backup_json([
        'ok' => true,
        'job' => $job,
        'busy' => backup_job_is_busy($job),
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
    $existing = backup_job_reconcile($work, backup_job_read($work));
    if (backup_job_is_busy($existing)) {
        backup_json(['ok' => false, 'message' => 'มีงานกำลังรันอยู่ รอให้จบก่อน'], 409);
    }
    $stamp = date('Ymd_His');
    $file = 'primacom_mini_erp_' . $stamp . '.sql.gz';
    $job = backup_job_new('dump', $file, backup_prev_dump_bytes($work));
    backup_job_write($work, $job);
    backup_spawn_worker('dump');
    backup_json([
        'ok' => true,
        'started' => true,
        'file' => $file,
        'job' => $job,
        'note' => 'dump รันพื้นหลัง — หน้าเว็บจะอัปเดต progress เอง',
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
    $existing = backup_job_reconcile($work, backup_job_read($work));
    if (backup_job_is_busy($existing)) {
        backup_json(['ok' => false, 'message' => 'มีงานกำลังรันอยู่ รอให้จบก่อน'], 409);
    }
    $job = backup_job_new('upload', $file, (int) filesize($full));
    backup_job_write($work, $job);
    backup_spawn_worker('upload', $file);
    backup_json([
        'ok' => true,
        'started' => true,
        'file' => $file,
        'job' => $job,
    ]);
}

backup_json(['ok' => false, 'message' => 'unknown action'], 400);
