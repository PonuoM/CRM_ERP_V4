<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once '../config.php';
$pdo = db_connect();

try {
    $input = json_decode(file_get_contents('php://input'), true);
    $productId = (int)($input['product_id'] ?? 0);
    $divisor = $input['divisor'] ?? null;
    $userId = $input['user_id'] ?? null;

    if (!$productId) {
        throw new Exception('Missing product_id');
    }

    // A change only ever takes effect from the current real-world month onward,
    // so it never rewrites how already-viewed past months were calculated.
    $effectiveFrom = date('Y-m-01');

    if ($divisor === null || $divisor === '' || (float)$divisor <= 0) {
        // Clear only this month's override; earlier history (if any) keeps applying going forward
        $pdo->prepare("DELETE FROM stock_arrival_ton_divisor_history WHERE product_id = ? AND effective_from = ?")
            ->execute([$productId, $effectiveFrom]);
        echo json_encode(['success' => true, 'divisor' => null]);
        exit;
    }

    $divisor = (float)$divisor;
    $stmt = $pdo->prepare("INSERT INTO stock_arrival_ton_divisor_history (product_id, divisor, effective_from, updated_by)
                            VALUES (?, ?, ?, ?)
                            ON DUPLICATE KEY UPDATE divisor = VALUES(divisor), updated_by = VALUES(updated_by)");
    $stmt->execute([$productId, $divisor, $effectiveFrom, $userId]);

    echo json_encode(['success' => true, 'divisor' => $divisor, 'effective_from' => $effectiveFrom]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
