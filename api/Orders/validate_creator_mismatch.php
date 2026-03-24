<?php
/**
 * Validate Creator Mismatch — ตรวจสอบ promotion orders ที่ parent.creator_id != child.creator_id
 *
 * GET ?company_id=1
 */
require_once __DIR__ . '/../config.php';

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

try {
    $pdo = db_connect();

    $companyId = isset($_GET['company_id']) ? (int) $_GET['company_id'] : 0;

    if ($companyId <= 0) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Invalid company_id']);
        exit();
    }

    // Count total promotion parent items
    $countStmt = $pdo->prepare("
        SELECT COUNT(DISTINCT parent.id) AS total
        FROM order_items parent
        JOIN orders o ON o.id = parent.parent_order_id
        WHERE parent.is_promotion_parent = 1
          AND o.company_id = ?
    ");
    $countStmt->execute([$companyId]);
    $totalPromo = (int) $countStmt->fetch()['total'];

    // Find promotion parents where at least one child has a different creator_id
    $sql = "
        SELECT
            parent.id AS parent_item_id,
            parent.parent_order_id AS order_id,
            parent.product_name AS promo_name,
            parent.quantity AS parent_qty,
            parent.creator_id AS parent_creator_id,
            o.order_date,
            o.total_amount,
            o.order_status,
            CONCAT(c.first_name, ' ', c.last_name) AS customer_name,
            c.phone AS customer_phone,
            CONCAT(pu.first_name, ' ', pu.last_name) AS parent_creator_name,
            COUNT(child.id) AS affected_children,
            GROUP_CONCAT(
                CONCAT(
                    child.product_name, ': ',
                    CONCAT(cu.first_name, ' ', cu.last_name), ' (', child.creator_id, ')',
                    ' → ',
                    CONCAT(pu.first_name, ' ', pu.last_name), ' (', parent.creator_id, ')'
                )
                SEPARATOR ' | '
            ) AS mismatch_detail
        FROM order_items child
        JOIN order_items parent ON parent.id = child.parent_item_id AND parent.is_promotion_parent = 1
        JOIN orders o ON o.id = parent.parent_order_id
        LEFT JOIN customers c ON c.customer_id = o.customer_id
        LEFT JOIN users pu ON pu.id = parent.creator_id
        LEFT JOIN users cu ON cu.id = child.creator_id
        WHERE child.creator_id != parent.creator_id
          AND o.company_id = ?
        GROUP BY parent.id
        ORDER BY o.order_date DESC
        LIMIT 500
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute([$companyId]);
    $mismatches = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Format results
    $results = array_map(function ($row) {
        return [
            'parent_item_id' => (int) $row['parent_item_id'],
            'order_id' => $row['order_id'],
            'order_date' => $row['order_date'],
            'order_status' => $row['order_status'],
            'customer_name' => $row['customer_name'],
            'customer_phone' => $row['customer_phone'],
            'total_amount' => (float) $row['total_amount'],
            'promo_name' => $row['promo_name'],
            'parent_qty' => (int) $row['parent_qty'],
            'parent_creator_id' => (int) $row['parent_creator_id'],
            'parent_creator_name' => $row['parent_creator_name'],
            'affected_children' => (int) $row['affected_children'],
            'mismatch_detail' => $row['mismatch_detail'],
        ];
    }, $mismatches);

    echo json_encode([
        'status' => 'success',
        'data' => $results,
        'summary' => [
            'total_promo_orders' => $totalPromo,
            'mismatch_count' => count($results),
        ],
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
?>
