<?php
/**
 * Validate Promotion Orders — ตรวจสอบคำสั่งซื้อที่มีโปรโมชั่น
 * ว่า child items net_total ตรงตาม validation rule หรือไม่
 *
 * Rule: SUM(child.net WHERE is_freebie=0) should equal parent.net + parent.discount
 * child net = (price_per_unit * quantity) - discount
 * parent net = (price_per_unit * quantity) - discount
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
        JOIN orders o ON o.id = parent.order_id
        WHERE parent.is_promotion_parent = 1
          AND o.company_id = ?
    ");
    $countStmt->execute([$companyId]);
    $totalPromo = (int) $countStmt->fetch()['total'];

    // Find promotion parents where children net != parent net + discount
    // child net_total = (price_per_unit * quantity) - discount
    // parent net_total = (price_per_unit * quantity) - discount
    // Validation: SUM(child net WHERE is_freebie=0) = parent_net + parent_discount
    $sql = "
        SELECT
            parent.id AS parent_item_id,
            parent.order_id,
            parent.product_name AS promo_name,
            parent.quantity AS parent_qty,
            parent.price_per_unit AS parent_price,
            parent.discount AS parent_discount,
            (parent.price_per_unit * parent.quantity - parent.discount) AS parent_net,
            parent.promotion_id,
            o.order_date,
            o.total_amount,
            o.order_status,
            CONCAT(c.first_name, ' ', c.last_name) AS customer_name,
            c.phone AS customer_phone,
            CONCAT(u.first_name, ' ', u.last_name) AS creator_name,
            SUM(CASE WHEN child.is_freebie = 0
                THEN (child.price_per_unit * child.quantity - child.discount)
                ELSE 0 END) AS children_sum,
            COUNT(child.id) AS child_count,
            SUM(child.is_freebie) AS freebie_count
        FROM order_items parent
        JOIN orders o ON o.id = parent.order_id
        LEFT JOIN customers c ON c.customer_id = o.customer_id
        LEFT JOIN users u ON u.id = o.creator_id
        JOIN order_items child ON child.parent_item_id = parent.id
        WHERE parent.is_promotion_parent = 1
          AND o.company_id = ?
        GROUP BY parent.id
        HAVING ABS(children_sum - ((parent.price_per_unit * parent.quantity - parent.discount) + parent.discount)) > 0.01
        ORDER BY o.order_date DESC
        LIMIT 500
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute([$companyId]);
    $mismatches = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Format results
    $results = array_map(function ($row) {
        $parentNet = (float) $row['parent_net'];
        $parentDiscount = (float) $row['parent_discount'];
        $childrenSum = (float) $row['children_sum'];
        $expected = $parentNet + $parentDiscount;
        $diff = $childrenSum - $expected;

        return [
            'parent_item_id' => (int) $row['parent_item_id'],
            'order_id' => $row['order_id'],
            'order_date' => $row['order_date'],
            'order_status' => $row['order_status'],
            'customer_name' => $row['customer_name'],
            'customer_phone' => $row['customer_phone'],
            'creator_name' => $row['creator_name'],
            'total_amount' => (float) $row['total_amount'],
            'promo_name' => $row['promo_name'],
            'promotion_id' => $row['promotion_id'] ? (int) $row['promotion_id'] : null,
            'parent_qty' => (int) $row['parent_qty'],
            'parent_net' => $parentNet,
            'parent_discount' => $parentDiscount,
            'children_sum' => $childrenSum,
            'expected' => $expected,
            'diff' => round($diff, 2),
            'child_count' => (int) $row['child_count'],
            'freebie_count' => (int) $row['freebie_count'],
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
