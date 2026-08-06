<?php
// รายชื่อบัญชีสำหรับแท็บ "สิทธิ์การจัดการ" ในหน้าตั้งค่าแพลนรับสินค้า
// เห็นได้เฉพาะ Super Admin / Admin Control / CEO (ดู stock_plan_permission.php)
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once '../config.php';
require_once 'stock_plan_company_group.php';
require_once 'stock_plan_permission.php';
$pdo = db_connect();

try {
    $actorId = isset($_GET['user_id']) ? (int)$_GET['user_id'] : 0;
    $companyId = isset($_GET['companyId']) ? (int)$_GET['companyId'] : null;

    if (!stock_plan_can_grant($pdo, $actorId)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'ไม่มีสิทธิ์ดูหน้าตั้งค่าสิทธิ์']);
        exit;
    }

    // บัญชีในกลุ่มบริษัทที่ทำงานร่วมกัน + คนที่เคยได้รับสิทธิ์ไว้แล้ว (แม้จะย้ายบริษัท/ปิดใช้งาน)
    $params = [];
    $scope = ['m.user_id IS NOT NULL'];
    if ($companyId) {
        $companyIds = stock_plan_company_ids($companyId);
        $placeholders = implode(',', array_fill(0, count($companyIds), '?'));
        $scope[] = "(u.company_id IN ($placeholders) AND u.status = 'active')";
        $params = array_merge($params, $companyIds);
    } else {
        $scope[] = "u.status = 'active'";
    }
    $scopeSql = implode(' OR ', $scope);

    $sql = "SELECT u.id, u.username, u.first_name, u.last_name, u.role, u.company_id, u.status,
                   COALESCE(m.can_manage, 0) AS can_manage,
                   m.created_at AS granted_at,
                   COALESCE(NULLIF(TRIM(CONCAT(COALESCE(g.first_name,''),' ',COALESCE(g.last_name,''))), ''), g.username) AS granted_by_name
            FROM users u
            LEFT JOIN stock_arrival_plan_managers m ON m.user_id = u.id
            LEFT JOIN users g ON g.id = m.granted_by
            WHERE $scopeSql
            ORDER BY u.company_id ASC, u.role ASC, u.first_name ASC, u.username ASC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    $adminRoles = STOCK_PLAN_ADMIN_ROLES;
    $data = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $name = trim(($row['first_name'] ?? '') . ' ' . ($row['last_name'] ?? ''));
        $alwaysAllowed = in_array($row['role'], $adminRoles, true);
        $data[] = [
            'id' => (int)$row['id'],
            'username' => $row['username'],
            'name' => $name !== '' ? $name : $row['username'],
            'role' => $row['role'],
            'company_id' => $row['company_id'] !== null ? (int)$row['company_id'] : null,
            'status' => $row['status'],
            'can_manage' => $alwaysAllowed || (int)$row['can_manage'] === 1,
            'always_allowed' => $alwaysAllowed,
            'granted_at' => $row['granted_at'],
            'granted_by_name' => $row['granted_by_name'],
        ];
    }

    echo json_encode(['success' => true, 'data' => $data, 'admin_roles' => $adminRoles]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
