<?php
/**
 * รายการ SO สั่งผลิต พร้อมยอดคงเหลือฝั่งโรงงาน
 *
 * ยอดทุกตัวคำนวณสดจากใบขน ไม่มีคอลัมน์เก็บสถานะซ้ำ:
 *   delivered = ออกใบขนแล้วทั้งหมด (ไม่นับใบที่ยกเลิก)
 *   pending   = ordered - delivered            -> "ยังไม่ผลิต"
 *   waiting   = ใบขนสถานะ issued               -> "ผลิตเสร็จ รอขนย้าย"
 *   picked    = ใบขนสถานะ picked_up            -> "เข้าคลังแล้ว"
 *   ∴ pending + waiting + picked = ordered เสมอ (บาลานซ์กับ SO)
 */
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
require_once 'stock_plan_company_group.php';
require_once 'production_progress.php';
$pdo = db_connect();

try {
    $userId    = isset($_GET['user_id']) ? (int)$_GET['user_id'] : 0;
    $companyId = isset($_GET['companyId']) ? (int)$_GET['companyId'] : 0;
    $factoryId = isset($_GET['factoryId']) ? (int)$_GET['factoryId'] : 0;
    $month     = isset($_GET['month']) ? (int)$_GET['month'] : 0;
    $year      = isset($_GET['year']) ? (int)$_GET['year'] : 0;
    $status    = $_GET['status'] ?? '';
    $progress  = $_GET['progress'] ?? '';
    $search    = trim($_GET['search'] ?? '');

    $where = ['1=1'];
    $params = [];

    if ($companyId > 0) {
        $ids = stock_plan_company_ids($companyId);
        $ph = implode(',', array_fill(0, count($ids), '?'));
        $where[] = "(o.company_id IN ($ph) OR o.company_id IS NULL)";
        $params = array_merge($params, $ids);
    }
    if ($factoryId > 0) {
        $where[] = 'o.factory_id = ?';
        $params[] = $factoryId;
    }
    if ($month && $year) {
        $where[] = 'MONTH(o.so_date) = ? AND YEAR(o.so_date) = ?';
        $params[] = $month;
        $params[] = $year;
    } elseif ($year) {
        $where[] = 'YEAR(o.so_date) = ?';
        $params[] = $year;
    }
    if ($status !== '') {
        $where[] = 'o.status = ?';
        $params[] = $status;
    }
    if ($search !== '') {
        $where[] = '(o.so_number LIKE ? OR o.notes LIKE ? OR EXISTS (
                        SELECT 1 FROM production_order_items si
                        JOIN stock_arrival_products sp ON sp.id = si.product_id
                        WHERE si.order_id = o.id AND (sp.sku LIKE ? OR sp.name LIKE ?)
                    ))';
        $like = "%$search%";
        array_push($params, $like, $like, $like, $like);
    }

    // บัญชี read-only ฝั่งโรงงานเห็นเฉพาะโรงงานตัวเอง
    production_apply_factory_scope($pdo, $userId, 'o', $where, $params);

    $sql = 'SELECT o.*,
                   f.code AS factory_code, f.name AS factory_name,
                   c.name AS company_name
            FROM production_orders o
            JOIN production_factories f ON f.id = o.factory_id
            LEFT JOIN companies c ON c.id = o.company_id
            WHERE ' . implode(' AND ', $where) . '
            ORDER BY o.so_date DESC, o.id DESC';
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $data = production_attach_items($pdo, $orders);

    // กรองตามความคืบหน้า (คำนวณสด จึงกรองหลังดึงข้อมูล)
    if ($progress !== '') {
        $data = array_values(array_filter($data, function ($o) use ($progress) {
            return $o['progress_status'] === $progress;
        }));
    }

    echo json_encode(['success' => true, 'data' => $data]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
