<?php
require_once __DIR__ . '/../config.php';

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Method not allowed']);
    exit();
}

try {
    $pdo = db_connect();
    $data = json_decode(file_get_contents('php://input'), true);

    if (!$data) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Invalid JSON']);
        exit();
    }

    $items = $data['items'] ?? [];
    $classifiedBy = $data['classified_by'] ?? null;

    if (empty($items)) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'No items provided']);
        exit();
    }

    $pdo->beginTransaction();

    $stmt = $pdo->prepare("
        INSERT INTO order_cancellations (order_id, cancellation_type_id, notes, classified_by)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            cancellation_type_id = VALUES(cancellation_type_id),
            notes = VALUES(notes),
            classified_by = VALUES(classified_by),
            classified_at = CURRENT_TIMESTAMP
    ");

    $successCount = 0;
    foreach ($items as $item) {
        $orderId = $item['order_id'] ?? null;
        $typeId = $item['cancellation_type_id'] ?? null;
        $notes = $item['notes'] ?? null;

        if (!$orderId || !$typeId) continue;

        $stmt->execute([$orderId, $typeId, $notes, $classifiedBy]);
        $successCount++;
    }

    $pdo->commit();

    echo json_encode([
        'status' => 'success',
        'message' => "Classified $successCount order(s)",
        'count' => $successCount
    ]);

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
?>
