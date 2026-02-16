<?php
/**
 * get_return_summary.php
 * Aggregate สรุปข้อมูลตีกลับ ตามช่วงวันที่ (orders.order_date)
 * สำหรับหน้า Reports
 */

require_once __DIR__ . '/../config.php';
cors();
$pdo = db_connect();

header('Content-Type: application/json; charset=utf-8');

try {
    $dateFrom = $_GET['date_from'] ?? '';
    $dateTo = $_GET['date_to'] ?? '';
    $companyId = intval($_GET['companyId'] ?? 0);

    if (!$dateFrom || !$dateTo) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'date_from and date_to are required']);
        exit;
    }

    $params = [$dateFrom, $dateTo];
    $companyFilter = '';
    if ($companyId > 0) {
        $companyFilter = 'AND o.company_id = ?';
        $params[] = $companyId;
    }

    // 1) ออเดอร์ทั้งหมดที่สถานะ Returned ในช่วงวันที่
    $sql1 = "
        SELECT COUNT(DISTINCT o.id) AS cnt
        FROM orders o
        WHERE o.order_status = 'Returned'
        AND DATE(o.order_date) >= ? AND DATE(o.order_date) <= ?
        $companyFilter
    ";
    $stmt = $pdo->prepare($sql1);
    $stmt->execute($params);
    $totalOrders = (int) $stmt->fetchColumn();

    // 2) ออเดอร์ทั้งหมดในช่วงวันที่ (ทุกสถานะ)
    $sql2 = "
        SELECT COUNT(DISTINCT o.id) AS cnt
        FROM orders o
        WHERE DATE(o.order_date) >= ? AND DATE(o.order_date) <= ?
        $companyFilter
    ";
    $stmt = $pdo->prepare($sql2);
    $stmt->execute($params);
    $allOrders = (int) $stmt->fetchColumn();

    // 3) จำนวนกล่องทั้งหมดที่ status = RETURNED
    $sql3 = "
        SELECT COUNT(*) AS cnt
        FROM order_boxes ob
        INNER JOIN orders o ON ob.order_id = o.id
        WHERE ob.status = 'RETURNED'
        AND DATE(o.order_date) >= ? AND DATE(o.order_date) <= ?
        $companyFilter
    ";
    $stmt = $pdo->prepare($sql3);
    $stmt->execute($params);
    $totalBoxes = (int) $stmt->fetchColumn();

    // 4) จำนวนกล่องแยกตาม return_status
    $sql4 = "
        SELECT ob.return_status, COUNT(*) AS cnt
        FROM order_boxes ob
        INNER JOIN orders o ON ob.order_id = o.id
        WHERE ob.status = 'RETURNED'
        AND DATE(o.order_date) >= ? AND DATE(o.order_date) <= ?
        $companyFilter
        GROUP BY ob.return_status
    ";
    $stmt = $pdo->prepare($sql4);
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $statusCounts = [];
    foreach ($rows as $r) {
        $statusCounts[$r['return_status'] ?? 'null'] = (int) $r['cnt'];
    }

    echo json_encode([
        'success' => true,
        'summary' => [
            'totalOrders' => $totalOrders,
            'allOrders' => $allOrders,
            'totalBoxes' => $totalBoxes,
            'returning' => $statusCounts['returning'] ?? 0,
            'returned' => $statusCounts['returned'] ?? 0,
            'good' => $statusCounts['good'] ?? 0,
            'damaged' => $statusCounts['damaged'] ?? 0,
            'lost' => $statusCounts['lost'] ?? 0,
        ],
    ], JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage(),
    ]);
}
