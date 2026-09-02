<?php
/**
 * Lightweight DB ping. Does not load the index.php router or business services.
 * Safe to poll from UptimeRobot / the ERP UI. Never dumps or writes data.
 */
require_once __DIR__ . '/config.php';
cors();

try {
    $pdo = db_connect();
    $pdo->query('SELECT 1');
    json_response(['ok' => true, 'db' => 'up', 'status' => 'healthy']);
} catch (Throwable $e) {
    json_response([
        'ok' => false,
        'db' => 'down',
        'error' => 'DB_UNAVAILABLE',
        'message' => 'ระบบฐานข้อมูลใช้ไม่ได้ กำลังกู้',
    ], 503);
}
