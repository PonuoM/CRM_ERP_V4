<?php
/**
 * สรุปยอดค้างฝั่งโรงงาน — ใช้ในแท็บ "รายงาน" และการ์ดสรุปบนหัวหน้าจอ
 *
 * แยกเป็นรายโรงงานและรายสินค้า เพื่อให้ทีมคลัง (Airport) เห็นล่วงหน้าว่าจะมีของอะไรเข้ามาเท่าไร
 * และโรงงานเห็นว่ายังค้างผลิตอะไรอยู่
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
    // ค่าเริ่มต้นดูเฉพาะ SO ที่ยังเปิดอยู่ (ยอดค้างจริง) -- all = รวมที่ปิด/ยกเลิกด้วย
    $scope     = $_GET['scope'] ?? 'open';

    $where = ['1=1'];
    $params = [];

    if ($scope !== 'all') {
        $where[] = "o.status = 'open'";
    }
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

    production_apply_factory_scope($pdo, $userId, 'o', $where, $params);

    $sql = 'SELECT o.id, o.so_number, o.status, o.factory_id, o.so_date,
                   f.code AS factory_code, f.name AS factory_name
            FROM production_orders o
            JOIN production_factories f ON f.id = o.factory_id
            WHERE ' . implode(' AND ', $where);
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $orders = production_attach_items($pdo, $stmt->fetchAll(PDO::FETCH_ASSOC));

    $blank = [
        'ordered_qty' => 0, 'delivered_qty' => 0, 'pending_qty' => 0,
        'waiting_qty' => 0, 'picked_qty' => 0, 'received_qty' => 0, 'shortage_qty' => 0,
    ];
    $totals = $blank;
    $byFactory = [];
    $byProduct = [];

    foreach ($orders as $o) {
        $fid = (int)$o['factory_id'];
        if (!isset($byFactory[$fid])) {
            $byFactory[$fid] = array_merge($blank, [
                'factory_id' => $fid,
                'factory_code' => $o['factory_code'],
                'factory_name' => $o['factory_name'],
                'so_count' => 0,
            ]);
        }
        $byFactory[$fid]['so_count']++;

        foreach ($o['items'] as $it) {
            foreach ($blank as $k => $_) {
                $totals[$k] += $it[$k];
                $byFactory[$fid][$k] += $it[$k];
            }
            $pid = (int)$it['product_id'];
            if (!isset($byProduct[$pid])) {
                $byProduct[$pid] = array_merge($blank, [
                    'product_id' => $pid,
                    'sku' => $it['sku'],
                    'product_name' => $it['product_name'],
                ]);
            }
            foreach ($blank as $k => $_) {
                $byProduct[$pid][$k] += $it[$k];
            }
        }
    }

    // คิวใบขนที่ออกแล้วรอ Airport มารับ — ทีมคลังใช้จัดรถ/พื้นที่
    $qWhere = ["d.status = 'issued'"];
    $qParams = [];
    if ($factoryId > 0) {
        $qWhere[] = 'd.factory_id = ?';
        $qParams[] = $factoryId;
    }
    production_apply_factory_scope($pdo, $userId, 'd', $qWhere, $qParams);

    $queueStmt = $pdo->prepare('SELECT d.factory_id, f.code AS factory_code, f.name AS factory_name,
                                       COUNT(DISTINCT d.id) AS note_count,
                                       COALESCE(SUM(di.qty), 0) AS qty,
                                       MIN(d.issued_date) AS oldest_issued_date
                                FROM production_delivery_notes d
                                JOIN production_factories f ON f.id = d.factory_id
                                LEFT JOIN production_delivery_note_items di ON di.delivery_note_id = d.id
                                WHERE ' . implode(' AND ', $qWhere) . '
                                GROUP BY d.factory_id, f.code, f.name
                                ORDER BY f.sort_order, f.id');
    $queueStmt->execute($qParams);

    usort($byProduct, function ($a, $b) {
        return $b['pending_qty'] <=> $a['pending_qty'];
    });

    echo json_encode([
        'success' => true,
        'data' => [
            'totals' => $totals,
            'by_factory' => array_values($byFactory),
            'by_product' => array_values($byProduct),
            'pickup_queue' => $queueStmt->fetchAll(PDO::FETCH_ASSOC),
            'order_count' => count($orders),
        ],
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
