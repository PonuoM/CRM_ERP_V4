<?php
// สิทธิ์ของผู้ใช้คนหนึ่งในระบบแพลนรับสินค้า — frontend ใช้ตัดสินว่าจะโชว์ปุ่มเพิ่ม/ลบ/แท็บสิทธิ์
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once '../config.php';
require_once 'stock_plan_permission.php';
$pdo = db_connect();

try {
    $userId = isset($_GET['user_id']) ? (int)$_GET['user_id'] : 0;

    $role = stock_plan_user_role($pdo, $userId);
    $canGrant = stock_plan_can_grant($pdo, $userId);
    $canManage = stock_plan_can_manage($pdo, $userId);

    echo json_encode([
        'success' => true,
        'data' => [
            'user_id' => $userId,
            'role' => $role,
            'can_manage' => $canManage,
            'can_grant' => $canGrant,
            'is_super_admin' => $role === 'Super Admin',
        ],
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
