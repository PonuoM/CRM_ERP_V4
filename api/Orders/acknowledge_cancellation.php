<?php
require_once __DIR__ . '/../config.php';

try {
    $pdo = db_connect();
    $user = get_authenticated_user($pdo);
    if (!$user) {
        json_response(['error' => 'UNAUTHORIZED'], 401);
    }

    $in = json_input();
    $orderId = $in['orderId'] ?? $in['order_id'] ?? null;
    
    if (!$orderId) {
        json_response(['error' => 'BAD_REQUEST', 'message' => 'orderId is required'], 400);
    }

    // Role check - Only Supervisor or Admin can acknowledge? 
    // Wait, the prompt says Supervisor Telesale. 
    // Let's allow Supervisor and SuperAdmin/Admin.
    $role = $user['role'];
    if ($role === 'Telesale') {
        json_response(['error' => 'FORBIDDEN', 'message' => 'Telesales cannot acknowledge orders'], 403);
    }

    // Check if the order cancellation record exists, if not, create it with default or unclassified.
    // However, the rule is to only acknowledge existing cancellations? 
    // Wait, if it doesn't exist, we should upsert it. But we don't have cancellation_type_id.
    // It's safer to just set is_acknowledged=1 where order_id = ?. If it doesn't exist, create an empty one with a default type or NULL (but cancellation_type_id is NOT NULL).
    // Let's just upsert using a dummy type if necessary? No, `manage_cancellation_types.php` gets default_cancellation_type_id from app_settings.
    
    // First, check if order_cancellations exists
    $stmtCheck = $pdo->prepare("SELECT id FROM order_cancellations WHERE order_id = ?");
    $stmtCheck->execute([$orderId]);
    $row = $stmtCheck->fetch();

    if ($row) {
        // Update
        $stmtUpdate = $pdo->prepare("UPDATE order_cancellations SET is_acknowledged = 1, acknowledged_by = ?, acknowledged_at = NOW() WHERE order_id = ?");
        $stmtUpdate->execute([$user['id'], $orderId]);
    } else {
        // Create new record with default cancellation type
        // Fetch default type
        $stmtDef = $pdo->query("SELECT setting_value FROM app_settings WHERE setting_key = 'default_cancellation_type_id'");
        $def = $stmtDef->fetchColumn();
        
        if (!$def) {
            // fallback to first active type
            $stmtFallback = $pdo->query("SELECT id FROM cancellation_types WHERE is_active = 1 ORDER BY sort_order ASC LIMIT 1");
            $def = $stmtFallback->fetchColumn();
        }

        if (!$def) {
             json_response(['error' => 'INTERNAL_ERROR', 'message' => 'No cancellation types available'], 500);
        }

        $stmtInsert = $pdo->prepare("INSERT INTO order_cancellations (order_id, cancellation_type_id, classified_by, is_acknowledged, acknowledged_by, acknowledged_at) VALUES (?, ?, ?, 1, ?, NOW())");
        $stmtInsert->execute([$orderId, $def, $user['id'], $user['id']]);
    }

    json_response(['ok' => true]);

} catch (Throwable $e) {
    json_response(['error' => 'INTERNAL_ERROR', 'message' => $e->getMessage()], 500);
}
