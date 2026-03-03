<?php
// SO Delete API — Delete Stock Order (only if no items received)
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

require_once __DIR__ . '/../config.php';
$pdo = db_connect();

try {
    $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
    if (!$id) throw new Exception("Stock Order ID required");

    // Check if any items have been received
    $stmt = $pdo->prepare("SELECT SUM(received_quantity) FROM inv2_stock_order_items WHERE stock_order_id = ?");
    $stmt->execute([$id]);
    $totalReceived = (float)$stmt->fetchColumn();

    if ($totalReceived > 0) {
        throw new Exception("Cannot delete SO that has received items. Total received: $totalReceived");
    }

    // Check if any receive documents reference this SO
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM inv2_receive_documents WHERE stock_order_id = ?");
    $stmt->execute([$id]);
    if ((int)$stmt->fetchColumn() > 0) {
        throw new Exception("Cannot delete SO that has receive documents");
    }

    $pdo->beginTransaction();

    // Delete items first (cascade should handle this but be explicit)
    $pdo->prepare("DELETE FROM inv2_stock_order_items WHERE stock_order_id = ?")->execute([$id]);
    $pdo->prepare("DELETE FROM inv2_stock_orders WHERE id = ?")->execute([$id]);

    $pdo->commit();

    echo json_encode(['success' => true]);

} catch (Exception $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
