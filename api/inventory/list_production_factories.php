<?php
// รายชื่อโรงงานผลิต — กรองตามขอบเขตของผู้ใช้ (บัญชีโรงงานเห็นเฉพาะของตัวเอง)
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
    $includeInactive = !empty($_GET['include_inactive']);

    $where = ['1=1'];
    $params = [];
    if (!$includeInactive) {
        $where[] = 'f.is_active = 1';
    }

    $ids = production_visible_factory_ids($pdo, $userId);
    if (!empty($ids)) {
        $ph = implode(',', array_fill(0, count($ids), '?'));
        $where[] = "f.id IN ($ph)";
        $params = array_merge($params, $ids);
    }

    $sql = 'SELECT f.id, f.code, f.name, f.note, f.sort_order, f.is_active
            FROM production_factories f
            WHERE ' . implode(' AND ', $where) . '
            ORDER BY f.sort_order, f.id';
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    echo json_encode(['success' => true, 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
