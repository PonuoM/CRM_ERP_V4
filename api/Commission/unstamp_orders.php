<?php
/**
 * Unstamp Orders — Delete stamps (whole batch or specific orders)
 * POST { batch_id } — delete entire batch
 * POST { batch_id, order_ids: [string] } — delete specific orders from batch
 * POST { order_ids: [string] } — delete all stamps for given order_ids across all batches
 */
require_once __DIR__ . "/../config.php";

header('Content-Type: application/json; charset=utf-8');

try {
    $pdo = db_connect();
    $input = json_decode(file_get_contents('php://input'), true);

    $batch_id = (int)($input['batch_id'] ?? 0);
    $order_ids = $input['order_ids'] ?? [];

    if (!$batch_id && empty($order_ids)) {
        echo json_encode(['ok' => false, 'error' => 'Provide batch_id or order_ids']);
        exit;
    }

    $pdo->beginTransaction();

    $deleted = 0;

    if ($batch_id && empty($order_ids)) {
        // Delete entire batch (cascade deletes stamps)
        $stmt = $pdo->prepare("DELETE FROM commission_stamp_batches WHERE id = ?");
        $stmt->execute([$batch_id]);
        $deleted = $stmt->rowCount();
    } elseif ($batch_id && !empty($order_ids)) {
        // Delete specific orders from batch
        $placeholders = implode(',', array_fill(0, count($order_ids), '?'));
        $params = array_merge([$batch_id], $order_ids);
        $stmt = $pdo->prepare("DELETE FROM commission_stamp_orders WHERE batch_id = ? AND order_id IN ($placeholders)");
        $stmt->execute($params);
        $deleted = $stmt->rowCount();

        // Update batch counts
        $countStmt = $pdo->prepare("
            SELECT COUNT(*) as cnt, COALESCE(SUM(commission_amount), 0) as total
            FROM commission_stamp_orders WHERE batch_id = ?
        ");
        $countStmt->execute([$batch_id]);
        $counts = $countStmt->fetch(PDO::FETCH_ASSOC);
        $pdo->prepare("UPDATE commission_stamp_batches SET order_count = ?, total_commission = ? WHERE id = ?")->execute([$counts['cnt'], $counts['total'], $batch_id]);
    } else {
        // Delete all stamps for order_ids across all batches
        $placeholders = implode(',', array_fill(0, count($order_ids), '?'));
        $stmt = $pdo->prepare("DELETE FROM commission_stamp_orders WHERE order_id IN ($placeholders)");
        $stmt->execute($order_ids);
        $deleted = $stmt->rowCount();

        // Recalculate affected batches
        $batchStmt = $pdo->query("
            SELECT b.id FROM commission_stamp_batches b
            LEFT JOIN commission_stamp_orders o ON o.batch_id = b.id
            GROUP BY b.id
        ");
        foreach ($batchStmt->fetchAll(PDO::FETCH_COLUMN) as $bid) {
            $countStmt = $pdo->prepare("SELECT COUNT(*) as cnt, COALESCE(SUM(commission_amount), 0) as total FROM commission_stamp_orders WHERE batch_id = ?");
            $countStmt->execute([$bid]);
            $counts = $countStmt->fetch(PDO::FETCH_ASSOC);
            $pdo->prepare("UPDATE commission_stamp_batches SET order_count = ?, total_commission = ? WHERE id = ?")->execute([$counts['cnt'], $counts['total'], $bid]);
        }
    }

    $pdo->commit();

    echo json_encode(['ok' => true, 'deleted' => $deleted]);

} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}
