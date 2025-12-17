<?php

function handle_revenue_recognition(PDO $pdo) {
    // Only allow GET method
    if (method() !== 'GET') {
        json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }

    $month = $_GET['month'] ?? date('m');
    $year = $_GET['year'] ?? date('Y');

    // Query Reasoning:
    // We want to display orders that are relevant to the selected Accounting Month.
    // 1. Orders created in this month (Potential Revenue)
    // 2. Orders that had "Goods Issue" in this month (Recognized Revenue)
    // Even if an order was created in Nov, if it shipped in Dec, it should appear when filtering for Dec.

    try {
        $sql = "
            SELECT 
                o.id, 
                o.order_date, 
                o.total_amount, 
                o.customer_id, 
                CONCAT(c.first_name, ' ', c.last_name) as customer_name,
                o.order_status, 
                o.shipping_provider, 
                (SELECT GROUP_CONCAT(tracking_number SEPARATOR ', ') FROM order_tracking_numbers WHERE parent_order_id = o.id) as tracking_no,
                -- Find the earliest 'Goods Issue' event from the logs
                -- Find the earliest 'Goods Issue' event from the logs OR use delivery_date for Airport
                IF(o.shipping_provider = 'Airport', o.delivery_date, (
                    SELECT MIN(changed_at) 
                    FROM order_status_logs LOG 
                    WHERE LOG.order_id = o.id 
                    AND (
                        LOG.new_status IN ('Shipping', 'Shipped', 'Delivered', 'Completed') 
                        OR LOG.trigger_type = 'TrackingUpdate'
                    )
                )) as goods_issue_date
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
                        LOG.new_status IN ('Shipping', 'Shipped', 'Delivered', 'Completed') 
                        OR LOG.trigger_type = 'TrackingUpdate'
                    )
                )
                OR
                -- Filter 3: Airport orders with delivery_date in this month
                (o.shipping_provider = 'Airport' AND MONTH(o.delivery_date) = :m3 AND YEAR(o.delivery_date) = :y3)
            ORDER BY o.order_date DESC
        ";

        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            ':m1' => $month, ':y1' => $year,
            ':m2' => $month, ':y2' => $year,
            ':m3' => $month, ':y3' => $year
        ]);
        
        $data = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Process logic in PHP to determine status
        foreach ($data as &$row) {
            $row['total_amount'] = (float)$row['total_amount'];
            
            $orderDate = new DateTime($row['order_date']);
            $row['order_month'] = $orderDate->format('Y-m');
            
            $row['is_recognized'] = false;
            $row['revenue_month'] = null;

            if ($row['goods_issue_date']) {
                $issueDate = new DateTime($row['goods_issue_date']);
                $row['revenue_month'] = $issueDate->format('Y-m');
                $row['is_recognized'] = true;
            } else {
                // Fallback for legacy/manual data checks
                if (!empty($row['tracking_no']) || in_array($row['order_status'], ['Shipping', 'Shipped', 'Delivered', 'Completed'])) {
                    $row['status_note'] = 'Legacy/Manual Check';
                }
            }
            
            // Flag for Cross-Period Revenue
            // (Revenue recognized in a different month than order creation)
            $row['cross_period'] = ($row['is_recognized'] && $row['revenue_month'] !== $row['order_month']);
            
            // Flag for "Should be recognized but isn't"
            // (Order in this month, but not shipped yet)
            $row['pending_issue'] = (!$row['is_recognized'] && $row['order_month'] == "$year-$month");
        }

        json_response($data);

    } catch (PDOException $e) {
        json_response(['ok' => false, 'error' => $e->getMessage()], 500);
    }
}

