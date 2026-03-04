<?php
/**
 * Company List API (lightweight)
 * สำหรับใช้ในหน้าตั้งค่า export template เท่านั้น
 * 
 * GET - List all companies (id, name)
 */

require_once __DIR__ . '/../config.php';

cors();
header('Content-Type: application/json; charset=utf-8');

try {
    $pdo = db_connect();
} catch (Exception $e) {
    json_response(['error' => 'DB_CONNECTION_FAILED', 'message' => $e->getMessage()], 500);
}

$stmt = $pdo->query('SELECT id, name FROM companies ORDER BY id ASC');
json_response($stmt->fetchAll());
