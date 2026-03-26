<?php
/**
 * Get Order Boxes API
 * 
 * Fetch order_boxes data for given order IDs.
 * Used by ReportsPage to get return_status per box for returned orders.
 *
 * GET ?order_ids=250101-00001,250101-00002,...
 * Response: { "ok": true, "boxes": [{ order_id, box_number, return_status, ... }] }
 */
require_once '../config.php';

cors();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    json_response(['error' => 'Method not allowed'], 405);
}

try {
    $pdo = db_connect();

    $user = get_authenticated_user($pdo);
    if (!$user) {
        json_response(['error' => 'UNAUTHORIZED'], 401);
    }

    $orderIdsRaw = $_GET['order_ids'] ?? '';
    if (empty($orderIdsRaw)) {
        json_response(['ok' => true, 'boxes' => []]);
    }

    $orderIds = array_filter(array_map('trim', explode(',', $orderIdsRaw)));
    if (empty($orderIds)) {
        json_response(['ok' => true, 'boxes' => []]);
    }

    // Limit to 500 IDs
    $orderIds = array_slice($orderIds, 0, 500);

    $placeholders = implode(',', array_fill(0, count($orderIds), '?'));
    $sql = "SELECT order_id, box_number, sub_order_id, return_status
            FROM order_boxes
            WHERE order_id IN ($placeholders)
            ORDER BY order_id, box_number";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($orderIds);
    $boxes = $stmt->fetchAll(PDO::FETCH_ASSOC);

    json_response([
        'ok' => true,
        'boxes' => $boxes
    ]);

} catch (Exception $e) {
    json_response(['error' => $e->getMessage()], 500);
}
?>
