<?php
require_once __DIR__ . '/../config.php';

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");

$orderId = $_GET['order_id'] ?? '';

if (empty($orderId)) {
    echo json_encode(['status' => 'success', 'data' => null]);
    exit();
}

try {
    $pdo = db_connect();
    $stmt = $pdo->prepare("
        SELECT oc.cancellation_type_id, oc.notes, ct.label
        FROM order_cancellations oc
        LEFT JOIN cancellation_types ct ON ct.id = oc.cancellation_type_id
        WHERE oc.order_id = ?
        LIMIT 1
    ");
    $stmt->execute([$orderId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    echo json_encode([
        'status' => 'success',
        'data' => $row ?: null,
    ]);
} catch (Exception $e) {
    echo json_encode(['status' => 'success', 'data' => null]);
}
?>
