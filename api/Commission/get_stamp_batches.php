<?php
/**
 * Get Stamp Batches — List all batches with optional drill-down
 * GET ?company_id=&batch_id= (optional, for drill-down)
 */
require_once __DIR__ . "/../config.php";

header('Content-Type: application/json; charset=utf-8');

try {
    $pdo = db_connect();

    $company_id = (int)($_GET['company_id'] ?? 0);
    $batch_id = (int)($_GET['batch_id'] ?? 0);

    if ($batch_id > 0) {
        // Drill-down: get orders in batch
        $batchStmt = $pdo->prepare("
            SELECT b.*, u.first_name, u.last_name
            FROM commission_stamp_batches b
            LEFT JOIN users u ON u.id = b.created_by
            WHERE b.id = ?
        ");
        $batchStmt->execute([$batch_id]);
        $batch = $batchStmt->fetch(PDO::FETCH_ASSOC);

        if (!$batch) {
            echo json_encode(['ok' => false, 'error' => 'Batch not found']);
            exit;
        }

        $ordersStmt = $pdo->prepare("
            SELECT cso.*, 
                   o.order_date, o.total_amount, o.payment_status, o.order_status,
                   o.customer_id,
                   u.first_name as stamp_user_first, u.last_name as stamp_user_last,
                   cu.first_name as commission_user_first, cu.last_name as commission_user_last
            FROM commission_stamp_orders cso
            LEFT JOIN orders o ON o.id = cso.order_id
            LEFT JOIN users u ON u.id = cso.stamped_by
            LEFT JOIN users cu ON cu.id = cso.user_id
            WHERE cso.batch_id = ?
            ORDER BY cso.stamped_at DESC
        ");
        $ordersStmt->execute([$batch_id]);
        $orders = $ordersStmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode(['ok' => true, 'data' => ['batch' => $batch, 'orders' => $orders]]);
    } else {
        // List all batches (optionally filtered by order_id search)
        $order_id_search = trim($_GET['order_id'] ?? '');

        $sql = "
            SELECT b.*, u.first_name, u.last_name
            FROM commission_stamp_batches b
            LEFT JOIN users u ON u.id = b.created_by
        ";
        $joinParams = [];
        $whereParams = [];
        $wheres = [];

        if ($order_id_search !== '') {
            $sql .= " INNER JOIN commission_stamp_orders cso_search ON cso_search.batch_id = b.id AND cso_search.order_id LIKE ?";
            $joinParams[] = "%{$order_id_search}%";
        }

        if ($company_id > 0) {
            $wheres[] = "b.company_id = ?";
            $whereParams[] = $company_id;
        }

        if (count($wheres) > 0) {
            $sql .= " WHERE " . implode(' AND ', $wheres);
        }

        $sql .= " GROUP BY b.id ORDER BY b.created_at DESC";

        $params = array_merge($joinParams, $whereParams);
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $batches = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode(['ok' => true, 'data' => $batches]);
    }

} catch (Exception $e) {
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}
