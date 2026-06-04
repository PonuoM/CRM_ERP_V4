<?php
require_once __DIR__ . '/../config.php';

try {
    $pdo = db_connect();
    $user = get_authenticated_user($pdo);
    if (!$user) {
        json_response(['error' => 'UNAUTHORIZED'], 401);
    }

    $companyId = $user['company_id'];
    $role = $user['role'];
    $userId = $user['id'];

    $dateStart = $_GET['dateStart'] ?? null;
    $dateEnd = $_GET['dateEnd'] ?? null;

    $conditions = ["o.order_status = 'Cancelled'", "o.company_id = ?"];
    $params = [$companyId];

    if ($dateStart) {
        $conditions[] = "o.order_date >= ?";
        $params[] = $dateStart . ' 00:00:00';
    }
    if ($dateEnd) {
        $conditions[] = "o.order_date <= ?";
        $params[] = $dateEnd . ' 23:59:59';
    }

    // Role visibility logic
    if ($role === 'Telesale') {
        $conditions[] = "o.creator_id = ?";
        $params[] = $userId;
    } else if ($role === 'Supervisor Telesale') {
        $conditions[] = "(o.creator_id = ? OR u.supervisor_id = ?)";
        $params[] = $userId;
        $params[] = $userId;
    }

    // Filter ONLY unacknowledged
    $conditions[] = "(oc.is_acknowledged IS NULL OR oc.is_acknowledged = 0)";

    $whereClause = implode(' AND ', $conditions);

    $sql = "
        SELECT 
            o.id as order_id,
            o.order_date,
            o.total_amount,
            CONCAT(u.first_name, ' ', u.last_name) as creator_name,
            u.id as creator_id,
            CONCAT(c.first_name, ' ', c.last_name) as customer_name,
            ct.label as cancellation_reason,
            oc.notes as cancellation_notes
        FROM orders o
        JOIN users u ON o.creator_id = u.id
        LEFT JOIN customers c ON o.customer_id = c.customer_id
        LEFT JOIN order_cancellations oc ON o.id = oc.order_id
        LEFT JOIN cancellation_types ct ON oc.cancellation_type_id = ct.id
        WHERE $whereClause
        ORDER BY o.order_date DESC
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);

    json_response(['ok' => true, 'orders' => $orders]);

} catch (Throwable $e) {
    json_response(['error' => 'INTERNAL_ERROR', 'message' => $e->getMessage()], 500);
}
