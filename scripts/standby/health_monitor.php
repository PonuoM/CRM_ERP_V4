<?php
/**
 * Health Monitor: Check production server health and send LINE Notify alerts.
 *
 * Designed to run via Windows Task Scheduler every 5 minutes
 * during business hours (07:00–18:00).
 *
 * Features:
 *   - Checks production health.php endpoint
 *   - Sends LINE Notify alert when server goes down (max 1 per 15 min)
 *   - Sends recovery notification when server comes back online
 *
 * Usage (CLI only):
 *   php scripts/standby/health_monitor.php
 */
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    die('CLI only');
}

set_time_limit(30);
date_default_timezone_set('Asia/Bangkok');

require_once __DIR__ . DIRECTORY_SEPARATOR . '..' . DIRECTORY_SEPARATOR
    . 'backup' . DIRECTORY_SEPARATOR . 'job.php';

// ─── Configuration ──────────────────────────────────────────────────────────

const HEALTH_URL        = 'https://prima49.com/mini_erp/api/health.php';
const HEALTH_TIMEOUT    = 10;   // seconds
const ALERT_COOLDOWN    = 900;  // 15 minutes — don't spam LINE
const STATE_FILE_NAME   = 'health_state.json';

// ─── Helpers ────────────────────────────────────────────────────────────────

function health_state_path(string $work): string
{
    $dir = $work . DIRECTORY_SEPARATOR . 'sync';
    if (!is_dir($dir)) mkdir($dir, 0777, true);
    return $dir . DIRECTORY_SEPARATOR . STATE_FILE_NAME;
}

function health_read_state(string $work): array
{
    $path = health_state_path($work);
    if (!is_file($path)) {
        return ['server_up' => true, 'last_alert_at' => 0, 'last_check_at' => null];
    }
    $data = json_decode((string) file_get_contents($path), true);
    return is_array($data) ? $data : ['server_up' => true, 'last_alert_at' => 0, 'last_check_at' => null];
}

function health_write_state(string $work, array $data): void
{
    $data['last_check_at'] = date('c');
    file_put_contents(
        health_state_path($work),
        json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT),
        LOCK_EX
    );
}

function send_line_notify(string $token, string $message): bool
{
    if (empty($token)) {
        echo "[WARN] LINE_NOTIFY_TOKEN not set, skipping alert\n";
        return false;
    }

    $ch = curl_init('https://notify-api.line.me/api/notify');
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => http_build_query(['message' => $message]),
        CURLOPT_HTTPHEADER     => ["Authorization: Bearer $token"],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 10,
        CURLOPT_SSL_VERIFYPEER => true,
    ]);
    $res  = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err  = curl_error($ch);
    curl_close($ch);

    if ($code === 200) {
        echo "[LINE] Alert sent successfully\n";
        return true;
    }
    echo "[LINE] Failed (HTTP $code): $err — $res\n";
    return false;
}

function check_server_health(): array
{
    $ctx = stream_context_create([
        'http' => [
            'timeout'       => HEALTH_TIMEOUT,
            'ignore_errors' => true,
        ],
        'ssl' => [
            'verify_peer'      => false,
            'verify_peer_name' => false,
        ],
    ]);

    $res = @file_get_contents(HEALTH_URL, false, $ctx);

    if ($res === false) {
        return ['up' => false, 'reason' => 'Connection failed or timeout'];
    }

    $data = json_decode($res, true);
    if (!is_array($data)) {
        return ['up' => false, 'reason' => 'Invalid JSON response'];
    }

    if (($data['db'] ?? '') === 'up' && ($data['ok'] ?? false) === true) {
        return ['up' => true, 'reason' => 'healthy'];
    }

    return ['up' => false, 'reason' => $data['error'] ?? $data['message'] ?? 'DB down'];
}

function get_last_sync_time(string $work): string
{
    $syncLog = $work . DIRECTORY_SEPARATOR . 'sync' . DIRECTORY_SEPARATOR . 'sync_log.json';
    if (!is_file($syncLog)) return 'ยังไม่เคย Sync';
    $data = json_decode((string) file_get_contents($syncLog), true);
    if (!is_array($data)) return 'ไม่ทราบ';
    return $data['finished_at'] ?? $data['started_at'] ?? 'ไม่ทราบ';
}

// ─── Main ───────────────────────────────────────────────────────────────────

$env   = backup_env();
$work  = backup_workdir($env);
$token = $env['LINE_NOTIFY_TOKEN'] ?? '';
$state = health_read_state($work);

$wasUp  = (bool) ($state['server_up'] ?? true);
$health = check_server_health();
$isUp   = $health['up'];

$ts = date('H:i:s');
echo "[$ts] Server check: " . ($isUp ? '✅ UP' : '❌ DOWN — ' . $health['reason']) . "\n";

if (!$isUp && $wasUp) {
    // ─── Transition: UP → DOWN ──────────────────────────────────────────
    echo "[$ts] 🚨 Server just went DOWN!\n";

    $lastSync = get_last_sync_time($work);
    $msg = "\n🚨 Server prima49.com ล่ม!"
         . "\n⏰ เวลา: " . date('d/m/Y H:i:s')
         . "\n❌ สาเหตุ: " . $health['reason']
         . "\n📦 ใช้ระบบสำรอง: http://127.0.0.1:8899"
         . "\n🔄 ข้อมูล Sync ล่าสุด: " . $lastSync;

    send_line_notify($token, $msg);

    $state['server_up']    = false;
    $state['down_since']   = date('c');
    $state['last_alert_at'] = time();
    health_write_state($work, $state);

} elseif (!$isUp && !$wasUp) {
    // ─── Still DOWN — repeat alert if cooldown passed ───────────────────
    $lastAlert = (int) ($state['last_alert_at'] ?? 0);
    if ((time() - $lastAlert) > ALERT_COOLDOWN) {
        $downSince = $state['down_since'] ?? 'ไม่ทราบ';
        $msg = "\n⚠️ Server prima49.com ยังล่มอยู่"
             . "\n⏰ ล่มตั้งแต่: " . $downSince
             . "\n❌ สาเหตุ: " . $health['reason']
             . "\n📦 ใช้ระบบสำรอง: http://127.0.0.1:8899";

        send_line_notify($token, $msg);
        $state['last_alert_at'] = time();
        health_write_state($work, $state);
    } else {
        echo "[$ts] Still down, cooldown active (next alert in " 
             . (ALERT_COOLDOWN - (time() - $lastAlert)) . "s)\n";
    }

} elseif ($isUp && !$wasUp) {
    // ─── Transition: DOWN → UP (Recovery) ───────────────────────────────
    $downSince = $state['down_since'] ?? 'ไม่ทราบ';
    echo "[$ts] ✅ Server RECOVERED!\n";

    $msg = "\n✅ Server prima49.com กลับมาออนไลน์แล้ว!"
         . "\n⏰ เวลา: " . date('d/m/Y H:i:s')
         . "\n📋 ล่มตั้งแต่: " . $downSince
         . "\n💡 กรุณาอัปเดตสถานะออเดอร์ใน ERP หากใช้ Standby Export ไป";

    send_line_notify($token, $msg);

    $state['server_up']    = true;
    $state['down_since']   = null;
    $state['last_alert_at'] = 0;
    health_write_state($work, $state);

} else {
    // ─── Still UP — nothing to do ───────────────────────────────────────
    health_write_state($work, $state);
}
