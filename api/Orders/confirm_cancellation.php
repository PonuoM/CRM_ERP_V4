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

    $successCount = 0;
    $validItems = [];

    // Filter valid items
    foreach ($items as $item) {
        $orderId = $item['order_id'] ?? null;
        $typeId = $item['cancellation_type_id'] ?? null;
        
        if (!$orderId || !$typeId) continue;
        
        $validItems[] = [
            'order_id' => $orderId,
            'type_id' => $typeId,
            'notes' => $item['notes'] ?? null
        ];
    }

    // Batch Insert (500 rows per query to avoid hitting parameter limits)
    $chunkSize = 500;
    $chunks = array_chunk($validItems, $chunkSize);

    foreach ($chunks as $chunk) {
        $placeholders = [];
        $params = [];
        
        foreach ($chunk as $row) {
            $placeholders[] = '(?, ?, ?, ?)';
            $params[] = $row['order_id'];
            $params[] = $row['type_id'];
            $params[] = $row['notes'];
            $params[] = $classifiedBy;
        }
        
        $sql = "INSERT INTO order_cancellations (order_id, cancellation_type_id, notes, classified_by) VALUES " . 
               implode(', ', $placeholders) . "
               ON DUPLICATE KEY UPDATE
               cancellation_type_id = VALUES(cancellation_type_id),
               notes = VALUES(notes),
               classified_by = VALUES(classified_by),
               classified_at = CURRENT_TIMESTAMP";
               
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $successCount += count($chunk);
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
