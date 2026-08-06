<?php
// ไทม์ไลน์หมายเหตุของแพลนรับสินค้า
//   ?plan_id=15                      -> เฉพาะแพลนเดียว
//   ?month=8&year=2026&companyId=1   -> ทุกแพลนของเดือนนั้น (ใช้ตอนโหลดปฏิทิน แล้วจัดกลุ่มฝั่ง frontend)
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
$pdo = db_connect();

try {
    $planId = isset($_GET['plan_id']) ? (int)$_GET['plan_id'] : 0;
    $month = isset($_GET['month']) ? (int)$_GET['month'] : null;
    $year = isset($_GET['year']) ? (int)$_GET['year'] : null;
    $companyId = isset($_GET['companyId']) ? (int)$_GET['companyId'] : null;

    $where = ['n.deleted_at IS NULL'];
    $params = [];

    if ($planId > 0) {
        $where[] = 'n.plan_id = ?';
        $params[] = $planId;
    } else {
        if ($month && $year) {
            // แพลนของเดือนนั้น หรือแพลนที่มีของเลื่อนมาเข้าเดือนนั้น (ให้ตรงกับสิ่งที่ปฏิทินแสดง)
            $where[] = '(
                (MONTH(p.planned_date) = ? AND YEAR(p.planned_date) = ?)
                OR EXISTS (
                    SELECT 1 FROM stock_arrival_plan_items i2
                    JOIN stock_arrival_plan_expectations e2 ON e2.item_id = i2.id
                    WHERE i2.plan_id = p.id
                      AND MONTH(COALESCE(e2.actual_date, e2.expected_date)) = ?
                      AND YEAR(COALESCE(e2.actual_date, e2.expected_date)) = ?
                )
            )';
            $params[] = $month;
            $params[] = $year;
            $params[] = $month;
            $params[] = $year;
        }
        // บริษัทที่ทำงานร่วมกันเห็นหมายเหตุของกันและกัน (เหมือน list_stock_plans.php)
        if ($companyId) {
            $companyIds = stock_plan_company_ids($companyId);
            $placeholders = implode(',', array_fill(0, count($companyIds), '?'));
            $where[] = "p.company_id IN ($placeholders)";
            $params = array_merge($params, $companyIds);
        }
    }

    $whereSql = implode(' AND ', $where);

    $sql = "SELECT n.id, n.plan_id, n.note, n.created_by, n.created_at,
                   COALESCE(NULLIF(TRIM(CONCAT(COALESCE(u.first_name,''),' ',COALESCE(u.last_name,''))), ''), u.username) AS created_by_name
            FROM stock_arrival_plan_notes n
            JOIN stock_arrival_plans p ON p.id = n.plan_id
            LEFT JOIN users u ON u.id = n.created_by
            WHERE $whereSql
            ORDER BY n.created_at ASC, n.id ASC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    $data = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $data[] = [
            'id' => (int)$row['id'],
            'plan_id' => (int)$row['plan_id'],
            'note' => $row['note'],
            'created_by' => $row['created_by'] !== null ? (int)$row['created_by'] : null,
            'created_by_name' => $row['created_by_name'],
            'created_at' => $row['created_at'],
        ];
    }

    echo json_encode(['success' => true, 'data' => $data]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
