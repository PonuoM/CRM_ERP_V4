<?php
/**
 * get_return_stats.php
 * นับจำนวน order_boxes แยกตาม return_status (ไม่ JOIN หนัก, เร็ว)
 * เรียกครั้งแรก + กด refresh เท่านั้น
 */

require_once __DIR__ . '/../config.php';
cors();
$pdo = db_connect();

header('Content-Type: application/json; charset=utf-8');

try {
    $companyId = intval($_GET['companyId'] ?? 0);

    $params = [];
    $companyFilter = '';
    if ($companyId > 0) {
        $companyFilter = 'AND o.company_id = ?';
        $params[] = $companyId;
    }

    $sql = "
        SELECT ob.return_status AS status, COUNT(*) AS cnt
        FROM order_boxes ob
        LEFT JOIN orders o ON ob.order_id = o.id
        WHERE ob.return_status IS NOT NULL
        $companyFilter
        GROUP BY ob.return_status
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Build map: status -> count
    $counts = [];
    foreach ($rows as $r) {
        $counts[$r['status']] = (int) $r['cnt'];
    }

    echo json_encode([
        'status' => 'success',
        'counts' => $counts,
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'error' => $e->getMessage(),
    ]);
}
