<?php
require_once __DIR__ . '/api/config.php';

try {
    $pdo = db_connect();
    
    $month = 12;
    $year = 2025;
    
    echo "Checking for orders in $year-$month...\n";
    
    // Check Orders
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM orders WHERE MONTH(order_date) = ? AND YEAR(order_date) = ?");
    $stmt->execute([$month, $year]);
    $orderCount = $stmt->fetchColumn();
    echo "Orders created in $year-$month: $orderCount\n";
    
    if ($orderCount > 0) {
        $stmt = $pdo->prepare("SELECT id, order_date, order_status FROM orders WHERE MONTH(order_date) = ? AND YEAR(order_date) = ? LIMIT 5");
        $stmt->execute([$month, $year]);
        $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo "Sample Orders:\n";
        print_r($orders);
    }

    // Check Logs
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM order_status_logs WHERE MONTH(changed_at) = ? AND YEAR(changed_at) = ?");
    $stmt->execute([$month, $year]);
    $logCount = $stmt->fetchColumn();
    echo "Logs created in $year-$month: $logCount\n";
    
    if ($logCount > 0) {
         $stmt = $pdo->prepare("SELECT * FROM order_status_logs WHERE MONTH(changed_at) = ? AND YEAR(changed_at) = ? LIMIT 5");
         $stmt->execute([$month, $year]);
         $logs = $stmt->fetchAll(PDO::FETCH_ASSOC);
         echo "Sample Logs:\n";
         print_r($logs);
    }

    // Run the actual query from get_revenue_recognition.php
    echo "\nRunning actual logic...\n";
    
     $sql = "
            SELECT 
                o.id, 
                o.order_date, 
                o.total_amount, 
                o.customer_id, 
                CONCAT(c.first_name, ' ', c.last_name) as customer_name,
                o.order_status, 
                (SELECT tracking_number FROM order_tracking_numbers WHERE parent_order_id = o.id LIMIT 1) as tracking_no,
                -- Find the earliest 'Goods Issue' event from the logs
                (
                    SELECT MIN(changed_at) 
                    FROM order_status_logs LOG 
                    WHERE LOG.order_id = o.id 
                    AND (
                        LOG.new_status IN ('Shipped', 'Delivered', 'Completed') 
                        OR LOG.trigger_type = 'TrackingUpdate'
                    )
                ) as goods_issue_date
            FROM orders o
            LEFT JOIN customers c ON c.customer_id = o.customer_id
            WHERE 
                -- Filter 1: Orders created in this month
                (MONTH(o.order_date) = :m1 AND YEAR(o.order_date) = :y1)
                OR
                -- Filter 2: Orders recognized (Goods Issue) in this month
                EXISTS (
                    SELECT 1 FROM order_status_logs LOG 
                    WHERE LOG.order_id = o.id 
                    AND MONTH(LOG.changed_at) = :m2 AND YEAR(LOG.changed_at) = :y2
                    AND (
                        LOG.new_status IN ('Shipped', 'Delivered', 'Completed') 
                        OR LOG.trigger_type = 'TrackingUpdate'
                    )
                )
            ORDER BY o.order_date DESC
        ";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            ':m1' => $month, ':y1' => $year,
            ':m2' => $month, ':y2' => $year
        ]);
        $data = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo "Actual Query Result Count: " . count($data) . "\n";
        if (count($data) > 0) {
            echo "First Row:\n";
            print_r($data[0]);
        }

} catch (PDOException $e) {
    echo "Error: " . $e->getMessage();
}
