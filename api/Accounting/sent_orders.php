<?php
require_once __DIR__ . '/../config.php';

function handle_sent_orders(PDO $pdo) {
    switch (method()) {
        case 'GET':
            $month = isset($_GET['month']) ? (int)$_GET['month'] : (int)date('m');
            $year = isset($_GET['year']) ? (int)$_GET['year'] : (int)date('Y');
            $bankId = isset($_GET['bankId']) && $_GET['bankId'] !== '' ? (int)$_GET['bankId'] : null;
            $search = isset($_GET['q']) ? trim($_GET['q']) : '';

            $params = [];
            $sql = "
                SELECT 
                    o.id,
                    o.order_date,
                    o.delivery_date,
                    o.customer_id,
                    COALESCE(c.first_name, '') as customer_first_name,
                    COALESCE(c.last_name, '') as customer_last_name,
                    o.recipient_first_name,
                    o.recipient_last_name,
                    o.total_amount,
                    o.payment_method,
                    o.payment_status,
                    o.order_status,
                    GROUP_CONCAT(DISTINCT otn.tracking_number SEPARATOR ', ') as tracking_numbers,
                    GROUP_CONCAT(DISTINCT CONCAT(b.bank, ' ', b.bank_number) SEPARATOR ', ') as bank_info,
                    SUM(os.amount) as total_slip_amount
                FROM orders o
                LEFT JOIN customers c ON c.customer_id = o.customer_id
                LEFT JOIN order_tracking_numbers otn ON otn.parent_order_id = o.id
                LEFT JOIN order_slips os ON os.order_id = o.id
                LEFT JOIN bank_account b ON b.id = os.bank_account_id
                WHERE 1=1
            ";

            // Filter Condition: Sent/Billed (Has Tracking OR Delivered/Returned OR Picked Up)
            // Note: 'Picked Up' is implicitly covered if they have status 'Delivered' or manually marked. 
            // The requirement says: "Orders with Tracking number, Status 'Delivered' or 'Returned', and 'Customer Picked Up'"
            // Since we don't have a specific 'Picked Up' status in enum, we rely on Delivered/Returned or presence of Tracking.
            $sql .= " AND (
                (otn.tracking_number IS NOT NULL AND otn.tracking_number <> '')
                OR o.order_status IN ('Delivered', 'Returned')
            )";

            // Filter by Date Range OR Month/Year
            $startDate = $_GET['startDate'] ?? null;
            $endDate = $_GET['endDate'] ?? null;

            if ($startDate && $endDate) {
                // Adjust logic to use formatted date strings
                $s = date('Y-m-d 00:00:00', strtotime($startDate));
                $e = date('Y-m-d 23:59:59', strtotime($endDate));
                // Use delivery_date (or order_date as fallback)
                $sql .= " AND COALESCE(o.delivery_date, o.order_date) BETWEEN ? AND ?";
                $params[] = $s;
                $params[] = $e;
            } else {
                // Fallback to Month/Year
                $sql .= " AND (
                    MONTH(COALESCE(o.delivery_date, o.order_date)) = ? 
                    AND YEAR(COALESCE(o.delivery_date, o.order_date)) = ?
                )";
                $params[] = $month;
                $params[] = $year;
            }

            // Filter by Bank
            if ($bankId) {
                $sql .= " AND os.bank_account_id = ?";
                $params[] = $bankId;
            }

            // Search
            if ($search) {
                $sql .= " AND (
                    o.id LIKE ? 
                    OR c.first_name LIKE ? 
                    OR c.last_name LIKE ?
                    OR o.recipient_first_name LIKE ?
                    OR o.recipient_last_name LIKE ?
                    OR otn.tracking_number LIKE ?
                )";
                $like = "%$search%";
                $params[] = $like;
                $params[] = $like;
                $params[] = $like;
                $params[] = $like;
                $params[] = $like;
                $params[] = $like;
            }

            $sql .= " GROUP BY o.id ORDER BY o.delivery_date DESC, o.order_date DESC";

            try {
                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
                $orders = $stmt->fetchAll();
                json_response($orders);
            } catch (PDOException $e) {
                json_response(['error' => 'QUERY_FAILED', 'message' => $e->getMessage()], 500);
            }
            break;

        default:
            json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }
}
?>
