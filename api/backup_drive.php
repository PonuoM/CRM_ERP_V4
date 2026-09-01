<?php
/**
 * Super Admin: Google Drive backup-folder listing (read-only).
 * Does not run mysqldump. Tokens live in app_settings with a per-deployment key.
 */
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/env_file.php';
cors();

function backup_drive_app(): string
{
    $app = basename(dirname(str_replace('\\', '/', __DIR__)));
    return $app !== '' ? $app : 'unknown';
}

function backup_drive_setting_key(): string
{
    $app = backup_drive_app();
    return $app === 'mini_erp' ? 'backup_drive_oauth' : 'backup_drive_oauth_' . $app;
}

function backup_drive_file_env(): array
{
    static $cached = null;
    if ($cached !== null) {
        return $cached;
    }
    $root = dirname(__DIR__);
    $cached = erp_merge_env_files([
        $root . DIRECTORY_SEPARATOR . '.env',
        $root . DIRECTORY_SEPARATOR . '.env.local',
        __DIR__ . DIRECTORY_SEPARATOR . '.env',
    ]);
    return $cached;
}

function backup_drive_env(string $name): string
{
    return erp_env_get($name, backup_drive_file_env());
}

function backup_drive_require_admin(PDO $pdo): array
{
    $user = get_authenticated_user($pdo);
    if (!$user) {
        json_response(['ok' => false, 'error' => 'UNAUTHORIZED'], 401);
    }
    if (($user['role'] ?? '') !== 'Super Admin') {
        json_response(['ok' => false, 'error' => 'FORBIDDEN', 'message' => 'เฉพาะ Super Admin'], 403);
    }
    return $user;
}

function backup_drive_ensure_settings(PDO $pdo): void
{
    $pdo->exec("CREATE TABLE IF NOT EXISTS app_settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        setting_key VARCHAR(100) NOT NULL UNIQUE,
        setting_value TEXT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}

function backup_drive_load_token(PDO $pdo): array
{
    backup_drive_ensure_settings($pdo);
    $stmt = $pdo->prepare('SELECT setting_value FROM app_settings WHERE setting_key = ? LIMIT 1');
    $stmt->execute([backup_drive_setting_key()]);
    $raw = $stmt->fetchColumn();
    if ($raw === false || $raw === null || trim((string) $raw) === '') {
        return [];
    }
    $decoded = json_decode((string) $raw, true);
    return is_array($decoded) ? $decoded : [];
}

function backup_drive_save_token(PDO $pdo, array $payload): void
{
    backup_drive_ensure_settings($pdo);
    $json = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    $stmt = $pdo->prepare(
        'INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)'
    );
    $stmt->execute([backup_drive_setting_key(), $json]);
}

function backup_drive_http(string $url, array $opts = []): array
{
    $ch = curl_init($url);
    $headers = $opts['headers'] ?? [];
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_HTTPHEADER => $headers,
    ]);
    if (!empty($opts['post'])) {
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $opts['post']);
    }
    $body = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);
    $decoded = is_string($body) ? json_decode($body, true) : null;
    return ['code' => $code, 'json' => is_array($decoded) ? $decoded : [], 'raw' => (string) $body, 'err' => $err];
}

function backup_drive_refresh(PDO $pdo, array $stored): array
{
    $clientId = backup_drive_env('GOOGLE_DRIVE_CLIENT_ID');
    $clientSecret = backup_drive_env('GOOGLE_DRIVE_CLIENT_SECRET');
    $refresh = (string) ($stored['refresh_token'] ?? '');
    if ($clientId === '' || $clientSecret === '' || $refresh === '') {
        return [];
    }
    $res = backup_drive_http('https://oauth2.googleapis.com/token', [
        'post' => http_build_query([
            'client_id' => $clientId,
            'client_secret' => $clientSecret,
            'refresh_token' => $refresh,
            'grant_type' => 'refresh_token',
        ]),
    ]);
    $access = (string) ($res['json']['access_token'] ?? '');
    if ($res['code'] !== 200 || $access === '') {
        return [];
    }
    return ['access_token' => $access];
}

$action = $_GET['action'] ?? $_POST['action'] ?? 'status';

try {
    $pdo = db_connect();
} catch (Throwable $e) {
    json_response([
        'ok' => false,
        'error' => 'DB_UNAVAILABLE',
        'message' => 'ระบบฐานข้อมูลใช้ไม่ได้ กำลังกู้',
    ], 503);
}

if ($action === 'oauth_callback') {
    $code = (string) ($_GET['code'] ?? '');
    $state = (string) ($_GET['state'] ?? '');
    $stored = backup_drive_load_token($pdo);
    if ($code === '' || $state === '' || $state !== (string) ($stored['oauth_state'] ?? '')) {
        header('Content-Type: text/html; charset=utf-8');
        echo '<p>เชื่อม Google Drive ไม่สำเร็จ (state ไม่ตรง)</p>';
        exit;
    }
    $redirect = backup_drive_env('GOOGLE_DRIVE_REDIRECT_URI');
    $res = backup_drive_http('https://oauth2.googleapis.com/token', [
        'post' => http_build_query([
            'code' => $code,
            'client_id' => backup_drive_env('GOOGLE_DRIVE_CLIENT_ID'),
            'client_secret' => backup_drive_env('GOOGLE_DRIVE_CLIENT_SECRET'),
            'redirect_uri' => $redirect,
            'grant_type' => 'authorization_code',
        ]),
    ]);
    $refresh = (string) ($res['json']['refresh_token'] ?? $stored['refresh_token'] ?? '');
    if ($res['code'] !== 200 || $refresh === '') {
        header('Content-Type: text/html; charset=utf-8');
        echo '<p>แลก token ไม่สำเร็จ ตรวจ client id/secret และ redirect URI</p>';
        exit;
    }
    unset($stored['oauth_state']);
    $stored['refresh_token'] = $refresh;
    $stored['connected_at'] = date('c');
    backup_drive_save_token($pdo, $stored);
    header('Content-Type: text/html; charset=utf-8');
    echo '<p>เชื่อม Google Drive สำเร็จ ปิดหน้านี้แล้วรีเฟรชหน้าสำรองฐานข้อมูล</p><script>window.close();</script>';
    exit;
}

backup_drive_require_admin($pdo);

if ($action === 'status' || $action === '') {
    $clientId = backup_drive_env('GOOGLE_DRIVE_CLIENT_ID');
    $folderId = trim(backup_drive_env('GOOGLE_DRIVE_FOLDER_ID'));
    $stored = backup_drive_load_token($pdo);
    if ($folderId === '') {
        $folderId = trim((string) ($stored['folder_id'] ?? ''));
    }
    $connected = !empty($stored['refresh_token']);
    $files = [];
    $listError = null;
    if ($connected && $folderId !== '') {
        $tok = backup_drive_refresh($pdo, $stored);
        if (empty($tok['access_token'])) {
            $listError = 'ต่ออายุ token ไม่ได้ — เชื่อมบัญชีใหม่';
        } else {
            $qs = http_build_query([
                'pageSize' => 50,
                'orderBy' => 'modifiedTime desc',
                'fields' => 'files(id,name,size,modifiedTime,md5Checksum)',
                'q' => sprintf("'%s' in parents and trashed = false", $folderId),
            ], '', '&', PHP_QUERY_RFC3986);
            $url = 'https://www.googleapis.com/drive/v3/files?' . $qs;
            $res = backup_drive_http($url, [
                'headers' => ['Authorization: Bearer ' . $tok['access_token']],
            ]);
            if ($res['code'] === 200) {
                foreach (($res['json']['files'] ?? []) as $f) {
                    $files[] = [
                        'id' => $f['id'] ?? '',
                        'name' => $f['name'] ?? '',
                        'size' => isset($f['size']) ? (int) $f['size'] : null,
                        'modified' => $f['modifiedTime'] ?? '',
                    ];
                }
            } else {
                $googleMsg = (string) ($res['json']['error']['message'] ?? '');
                $detail = $googleMsg !== '' ? $googleMsg : (string) ($res['err'] ?? '');
                $listError = 'อ่านโฟลเดอร์ Drive ไม่ได้'
                    . ($res['code'] > 0 ? ' (HTTP ' . $res['code'] . ')' : '')
                    . ($detail !== '' ? ' — ' . $detail : '');
            }
        }
    }
    json_response([
        'ok' => true,
        'deployment' => backup_drive_app(),
        'setting_key' => backup_drive_setting_key(),
        'client_configured' => $clientId !== '',
        'folder_configured' => $folderId !== '',
        'connected' => $connected,
        'connected_at' => $stored['connected_at'] ?? null,
        'files' => $files,
        'list_error' => $listError,
        'dump_from_host' => false,
        'message' => 'หน้านี้ดูสถานะไฟล์บน Drive เท่านั้น ไม่ได้รัน mysqldump บนโฮสต์',
    ]);
}

if ($action === 'oauth_start') {
    $clientId = backup_drive_env('GOOGLE_DRIVE_CLIENT_ID');
    $redirect = backup_drive_env('GOOGLE_DRIVE_REDIRECT_URI');
    if ($clientId === '' || $redirect === '') {
        json_response(['ok' => false, 'error' => 'NOT_CONFIGURED', 'message' => 'ยังไม่ได้ตั้ง GOOGLE_DRIVE_CLIENT_ID / REDIRECT_URI'], 400);
    }
    $state = bin2hex(random_bytes(16));
    $stored = backup_drive_load_token($pdo);
    $stored['oauth_state'] = $state;
    $folder = backup_drive_env('GOOGLE_DRIVE_FOLDER_ID');
    if ($folder !== '') {
        $stored['folder_id'] = $folder;
    }
    backup_drive_save_token($pdo, $stored);
    $url = 'https://accounts.google.com/o/oauth2/v2/auth?' . http_build_query([
        'client_id' => $clientId,
        'redirect_uri' => $redirect,
        'response_type' => 'code',
        'scope' => 'https://www.googleapis.com/auth/drive.readonly',
        'access_type' => 'offline',
        'prompt' => 'consent',
        'state' => $state,
    ]);
    json_response(['ok' => true, 'url' => $url]);
}

if ($action === 'disconnect') {
    backup_drive_save_token($pdo, []);
    json_response(['ok' => true]);
}

json_response(['ok' => false, 'error' => 'UNKNOWN_ACTION'], 400);
