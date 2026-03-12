<?php
// Dispatch Get API — Return detail items for a specific batch
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

require_once __DIR__ . '/../config.php';
$pdo = db_connect();

try {
    $batchId = $_GET['batch_id'] ?? null;
    if (!$batchId) throw new Exception('batch_id required');

    // Get batch header
    $stmt = $pdo->prepare("SELECT b.*, CONCAT(u.first_name, ' ', u.last_name) as created_by_name FROM inv2_dispatch_batches b LEFT JOIN users u ON b.created_by = u.id WHERE b.id = ?");
    $stmt->execute([$batchId]);
    $batch = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$batch) throw new Exception('Batch not found');

    // Get items
    $stmt = $pdo->prepare("SELECT * FROM inv2_dispatch_items WHERE batch_id = ? ORDER BY row_index ASC");
    $stmt->execute([$batchId]);
    $items = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'data' => [
            'batch' => $batch,
            'items' => $items
        ]
    ]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
