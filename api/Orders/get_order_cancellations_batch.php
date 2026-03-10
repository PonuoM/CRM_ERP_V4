<?php
require_once __DIR__ . '/../config.php';

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");

// Accepts comma-separated order_ids
$orderIds = $_GET['order_ids'] ?? '';

if (empty($orderIds)) {
    echo json_encode(['status' => 'success', 'data' => []]);
    exit();
}

try {
    $pdo = db_connect();
    $ids = array_filter(array_map('trim', explode(',', $orderIds)));

    if (empty($ids)) {
        echo json_encode(['status' => 'success', 'data' => []]);
        exit();
    }

    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $stmt = $pdo->prepare("
        SELECT oc.order_id, oc.cancellation_type_id, oc.notes, ct.label as type_label
        FROM order_cancellations oc
        LEFT JOIN cancellation_types ct ON ct.id = oc.cancellation_type_id
        WHERE oc.order_id IN ($placeholders)
    ");
    $stmt->execute($ids);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Index by order_id
    $result = [];
    foreach ($rows as $row) {
        $result[$row['order_id']] = $row;
    }

    echo json_encode(['status' => 'success', 'data' => $result]);
} catch (Exception $e) {
    echo json_encode(['status' => 'success', 'data' => []]);
}
?>
