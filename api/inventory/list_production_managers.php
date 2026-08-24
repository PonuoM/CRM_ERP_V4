<?php
// รายชื่อบัญชีสำหรับแท็บ "สิทธิ์" ในหน้าตั้งค่าสั่งผลิต
// เห็นได้เฉพาะ Super Admin / Admin Control / CEO (ดู production_permission.php)
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
require_once 'production_permission.php';
$pdo = db_connect();

try {
    $actorId = isset($_GET['user_id']) ? (int)$_GET['user_id'] : 0;
    $companyId = isset($_GET['companyId']) ? (int)$_GET['companyId'] : null;

    if (!production_can_grant($pdo, $actorId)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'ไม่มีสิทธิ์ดูหน้าตั้งค่าสิทธิ์']);
        exit;
    }

    // บัญชีในกลุ่มบริษัทที่ทำงานร่วมกัน + คนที่เคยได้รับสิทธิ์/ถูกล็อกโรงงานไว้แล้ว
    $params = [];
    $scope = ['m.user_id IS NOT NULL', 'uf.user_id IS NOT NULL'];
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
                   COALESCE(NULLIF(TRIM(CONCAT(COALESCE(g.first_name,''),' ',COALESCE(g.last_name,''))), ''), g.username) AS granted_by_name,
                   GROUP_CONCAT(DISTINCT uf.factory_id) AS factory_ids
            FROM users u
            LEFT JOIN production_managers m ON m.user_id = u.id
            LEFT JOIN production_user_factories uf ON uf.user_id = u.id
            LEFT JOIN users g ON g.id = m.granted_by
            WHERE $scopeSql
            GROUP BY u.id, u.username, u.first_name, u.last_name, u.role, u.company_id, u.status,
                     m.can_manage, m.created_at, g.first_name, g.last_name, g.username
            ORDER BY u.company_id ASC, u.role ASC, u.first_name ASC, u.username ASC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    $adminRoles = PRODUCTION_ADMIN_ROLES;
    $data = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $name = trim(($row['first_name'] ?? '') . ' ' . ($row['last_name'] ?? ''));
        $alwaysAllowed = in_array($row['role'], $adminRoles, true);
        $factoryIds = $row['factory_ids'] ? array_map('intval', explode(',', $row['factory_ids'])) : [];
        sort($factoryIds);
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
            // [] = เห็นทุกโรงงาน
            'factory_ids' => $factoryIds,
        ];
    }

    echo json_encode(['success' => true, 'data' => $data, 'admin_roles' => $adminRoles]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
