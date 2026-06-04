<?php
require_once __DIR__ . '/../config.php';

try {
    $pdo = db_connect();
    $user = get_authenticated_user($pdo);
    if (!$user) {
        json_response(['error' => 'UNAUTHORIZED'], 401);
    }

    $in = json_input();
    $orderIds = $in['orderIds'] ?? [];
    
    if (!is_array($orderIds) || empty($orderIds)) {
        json_response(['error' => 'BAD_REQUEST', 'message' => 'orderIds array is required'], 400);
    }

    $role = $user['role'];
    if ($role === 'Telesale') {
        json_response(['error' => 'FORBIDDEN', 'message' => 'Telesales cannot acknowledge orders'], 403);
    }

    // Default cancellation type if needed
    $stmtDef = $pdo->query("SELECT setting_value FROM app_settings WHERE setting_key = 'default_cancellation_type_id'");
    $def = $stmtDef->fetchColumn();
    if (!$def) {
        $stmtFallback = $pdo->query("SELECT id FROM cancellation_types WHERE is_active = 1 ORDER BY sort_order ASC LIMIT 1");
        $def = $stmtFallback->fetchColumn();
    }

    $pdo->beginTransaction();

    $sql = "
        INSERT INTO order_cancellations 
            (order_id, cancellation_type_id, classified_by, is_acknowledged, acknowledged_by, acknowledged_at) 
        VALUES 
            (?, ?, ?, 1, ?, NOW())
        ON DUPLICATE KEY UPDATE 
            is_acknowledged = 1,
            acknowledged_by = VALUES(acknowledged_by),
            acknowledged_at = NOW()
    ";
    
    $stmt = $pdo->prepare($sql);

    $successCount = 0;

    foreach ($orderIds as $orderId) {
        $stmt->execute([$orderId, $def, $user['id'], $user['id']]);
        $successCount++;
    }

    $pdo->commit();

    json_response(['ok' => true, 'count' => $successCount]);

} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    json_response(['error' => 'INTERNAL_ERROR', 'message' => $e->getMessage()], 500);
}
