<?php
require_once __DIR__ . '/../config.php';

function handle_outstanding_orders(PDO $pdo) {
    if (method() !== 'GET') {
        json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }

    $month = isset($_GET['month']) ? (int)$_GET['month'] : (int)date('m');
    $year = isset($_GET['year']) ? (int)$_GET['year'] : (int)date('Y');
    
    // Authenticate
    $user = get_authenticated_user($pdo);
    if (!$user) {
        json_response(['error' => 'UNAUTHORIZED'], 401);
    }
    $companyId = $user['company_id'];
    
    $startDate = sprintf('%04d-%02d-01 00:00:00', $year, $month);

    try {
        // Use full table names to avoid any aliasing ambiguity
        $sql = "
            SELECT 
                orders.id,
                orders.order_date,
                orders.delivery_date,
                customers.first_name as customer_first_name,
                customers.last_name as customer_last_name,
                orders.total_amount,
                orders.payment_method,
                orders.order_status,
                orders.payment_status,
                GROUP_CONCAT(order_tracking_numbers.tracking_number SEPARATOR ', ') as tracking_numbers
            FROM orders
            LEFT JOIN customers ON orders.customer_id = customers.customer_id
            LEFT JOIN order_tracking_numbers ON orders.id = order_tracking_numbers.order_id
            WHERE COALESCE(orders.delivery_date, orders.order_date) < ?
              AND orders.order_status NOT IN ('Delivered', 'Returned', 'Cancelled', 'BadDebt')
              AND orders.company_id = ?
            GROUP BY orders.id
            ORDER BY orders.order_date ASC
            LIMIT 500
        ";

        $stmt = $pdo->prepare($sql);
        $stmt->execute([$startDate, $companyId]);
        $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);

        json_response($orders);

    } catch (PDOException $e) {
        json_response(['error' => 'QUERY_FAILED', 'message' => $e->getMessage()], 500);
    }
}

if (basename(__FILE__) == basename($_SERVER["SCRIPT_FILENAME"])) {
    $pdo = db_connect();
    handle_outstanding_orders($pdo);
}
?>
