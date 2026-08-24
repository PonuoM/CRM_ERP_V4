<?php
// สิทธิ์ของผู้ใช้คนหนึ่งในระบบสั่งผลิต — frontend ใช้ตัดสินว่าจะโชว์ปุ่มแก้ไข/แท็บสิทธิ์
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once '../config.php';
require_once 'production_permission.php';
$pdo = db_connect();

try {
    $userId = isset($_GET['user_id']) ? (int)$_GET['user_id'] : 0;

    $role = production_user_role($pdo, $userId);

    echo json_encode([
        'success' => true,
        'data' => [
            'user_id' => $userId,
            'role' => $role,
            'can_manage' => production_can_manage($pdo, $userId),
            'can_grant' => production_can_grant($pdo, $userId),
            'is_super_admin' => $role === 'Super Admin',
            // [] = เห็นทุกโรงงาน
            'factory_ids' => production_visible_factory_ids($pdo, $userId),
        ],
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
