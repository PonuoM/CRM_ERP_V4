<?php
require_once __DIR__ . '/../config.php';

function handle_dashboard_stats(PDO $pdo) {
    if (method() !== 'GET') {
        json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }

    $month = isset($_GET['month']) ? (int)$_GET['month'] : (int)date('m');
    $year = isset($_GET['year']) ? (int)$_GET['year'] : (int)date('Y');
    
    try {
        $stats = [
            'current_month' => [
                'total_sales' => 0,
                'total_orders' => 0,
                'shipping_count' => 0,
                'shipping_amount' => 0,
                'returned_count' => 0,
                'returned_amount' => 0,
                'cancelled_count' => 0,
                'cancelled_amount' => 0,
                'pending_approval_count' => 0,
                'pending_approval_amount' => 0,
                'claiming_count' => 0,
                'claiming_amount' => 0,
                'bad_debt_count' => 0,
                'bad_debt_amount' => 0,
            ],
            'outstanding' => [
                'count' => 0,
                'amount' => 0
            ],
            'claiming_outstanding' => [
                'count' => 0,
                'amount' => 0
            ]
        ];

        // 1. Current Month Statistics
        // Logic: Filter by Month/Year of COALESCE(delivery_date, order_date)
        $sqlCurrent = "
            SELECT 
                COUNT(*) as count,
                SUM(total_amount) as total_amount,
                order_status,
                payment_status
            FROM orders
            WHERE MONTH(COALESCE(delivery_date, order_date)) = ? 
              AND YEAR(COALESCE(delivery_date, order_date)) = ?
            GROUP BY order_status, payment_status
        ";
        
        $stmtCurrent = $pdo->prepare($sqlCurrent);
        $stmtCurrent->execute([$month, $year]);
        $rowsCurrent = $stmtCurrent->fetchAll(PDO::FETCH_ASSOC);

        foreach ($rowsCurrent as $row) {
            $count = (int)$row['count'];
            $amount = (float)$row['total_amount'];
            $status = $row['order_status'];
            $payStatus = $row['payment_status'];

            // Aggregates
            $stats['current_month']['total_orders'] += $count;
            $stats['current_month']['total_sales'] += $amount;

            // Specific Statuses
            if ($status === 'Shipping') {
                $stats['current_month']['shipping_count'] += $count;
                $stats['current_month']['shipping_amount'] += $amount;
            } elseif ($status === 'Returned') {
                $stats['current_month']['returned_count'] += $count;
                $stats['current_month']['returned_amount'] += $amount;
            } elseif ($status === 'Cancelled') {
                $stats['current_month']['cancelled_count'] += $count;
                $stats['current_month']['cancelled_amount'] += $amount;
            } elseif ($status === 'Claiming') {
                $stats['current_month']['claiming_count'] += $count;
                $stats['current_month']['claiming_amount'] += $amount;
            } elseif ($status === 'BadDebt') {
                $stats['current_month']['bad_debt_count'] += $count;
                $stats['current_month']['bad_debt_amount'] += $amount;
            } elseif ($status === 'Delivered') {
                // Delivered but NOT Paid/Approved -> Waiting Approval
                if ($payStatus !== 'Paid' && $payStatus !== 'Approved') {
                    $stats['current_month']['pending_approval_count'] += $count;
                    $stats['current_month']['pending_approval_amount'] += $amount;
                }
            }
        }

        // 2. Outstanding (Previous Months)
        // Logic: Date < Selected Month/Year 
        // AND Status is NOT Final (Delivered, Returned, Cancelled, BadDebt)
        // AND Status is NOT Claiming (We'll track Claiming separately)
        
        $comparisonDate = sprintf('%04d-%02d-01 00:00:00', $year, $month);

        $sqlOutstanding = "
            SELECT 
                order_status,
                COUNT(*) as count,
                SUM(total_amount) as total_amount
            FROM orders
            WHERE COALESCE(delivery_date, order_date) < ?
              AND order_status NOT IN ('Delivered', 'Returned', 'Cancelled', 'BadDebt')
            GROUP BY order_status
        ";

        $stmtOutstanding = $pdo->prepare($sqlOutstanding);
        $stmtOutstanding->execute([$comparisonDate]);
        $rowsOutstanding = $stmtOutstanding->fetchAll(PDO::FETCH_ASSOC);

        foreach ($rowsOutstanding as $row) {
            $status = $row['order_status'];
            $count = (int)$row['count'];
            $amount = (float)$row['total_amount'];

            if ($status === 'Claiming') {
                $stats['claiming_outstanding']['count'] += $count;
                $stats['claiming_outstanding']['amount'] += $amount;
            } else {
                $stats['outstanding']['count'] += $count;
                $stats['outstanding']['amount'] += $amount;
            }
        }

        json_response($stats);

    } catch (PDOException $e) {
        json_response(['error' => 'QUERY_FAILED', 'message' => $e->getMessage()], 500);
    }
}

if (basename(__FILE__) == basename($_SERVER["SCRIPT_FILENAME"])) {
    $pdo = db_connect();
    handle_dashboard_stats($pdo);
}
?>
