<?php

class DistributionHelper {

    /**
     * Get Query Parts for 'New Sale' (Admin/Platform orders within freshDays)
     */
    public static function getNewSaleParts($companyId, $freshDays = 7, $searchTerm = '') {
        $params = [$companyId];
        
        $join = "JOIN orders o ON o.customer_id = c.customer_id ".
                "LEFT JOIN users u ON u.id = o.creator_id";
        
        $where = [
            "c.company_id = ?",
            "COALESCE(c.is_blocked,0) = 0",
            "c.assigned_to IS NULL",
            "(u.role = 'Admin Page' OR o.sales_channel IS NOT NULL OR o.sales_channel_page_id IS NOT NULL)",
            "(o.order_status IS NULL OR o.order_status <> 'Cancelled')",
            "o.order_date >= DATE_SUB(NOW(), INTERVAL ? DAY)"
        ];
        $params[] = max(0, $freshDays);

        if ($searchTerm !== '') {
            $where[] = "(c.first_name LIKE ? OR c.last_name LIKE ? OR c.phone LIKE ? OR c.customer_id LIKE ?)";
            $like = "%$searchTerm%";
            $params[] = $like; $params[] = $like; $params[] = $like; $params[] = $like;
        }

        return [
            'join' => $join,
            'where' => implode(" AND ", $where),
            'params' => $params,
            'groupBy' => "GROUP BY c.customer_id",
            'orderBy' => "ORDER BY MAX(o.order_date) DESC, c.date_assigned DESC"
        ];
    }

    /**
     * Get Query Parts for 'Waiting Return' (In basket > 30 days)
     */
    public static function getWaitingReturnParts($companyId, $searchTerm = '') {
        $params = [$companyId];
        $join = ""; // No extra joins needed
        
        $where = [
            "c.company_id = ?",
            "COALESCE(c.is_blocked,0) = 0",
            "c.is_in_waiting_basket = 1",
            "c.waiting_basket_start_date IS NOT NULL",
            "c.waiting_basket_start_date <= DATE_SUB(NOW(), INTERVAL 30 DAY)",
            "c.assigned_to IS NULL",
            "(c.last_follow_up_date IS NULL OR c.last_follow_up_date < DATE_SUB(NOW(), INTERVAL 7 DAY))"
        ];

        if ($searchTerm !== '') {
            $where[] = "(c.first_name LIKE ? OR c.last_name LIKE ? OR c.phone LIKE ? OR c.customer_id LIKE ?)";
            $like = "%$searchTerm%";
            $params[] = $like; $params[] = $like; $params[] = $like; $params[] = $like;
        }

        return [
            'join' => $join,
            'where' => implode(" AND ", $where),
            'params' => $params,
            'groupBy' => "",
            'orderBy' => "ORDER BY c.waiting_basket_start_date ASC"
        ];
    }

    /**
     * Get Query Parts for 'Stock'
     */
    public static function getStockParts($companyId, $freshDays = 7, $searchTerm = '') {
        $params = [$companyId];
        $join = "";
        
        $where = [
            "c.company_id = ?",
            "COALESCE(c.is_blocked,0) = 0",
            "c.assigned_to IS NULL",
            "(COALESCE(c.is_in_waiting_basket,0) = 0 OR (c.is_in_waiting_basket = 1 AND c.waiting_basket_start_date <= DATE_SUB(NOW(), INTERVAL 30 DAY)))",
            "NOT EXISTS (
                SELECT 1 FROM orders o
                LEFT JOIN users u ON u.id = o.creator_id
                WHERE o.customer_id = c.customer_id
                  AND (u.role = 'Admin Page' OR o.sales_channel IS NOT NULL OR o.sales_channel_page_id IS NOT NULL)
                  AND (o.order_status IS NULL OR o.order_status <> 'Cancelled')
                  AND o.order_date >= DATE_SUB(NOW(), INTERVAL ? DAY)
            )"
        ];
        $params[] = max(0, $freshDays);

        if ($searchTerm !== '') {
            $where[] = "(c.first_name LIKE ? OR c.last_name LIKE ? OR c.phone LIKE ? OR c.customer_id LIKE ?)";
            $like = "%$searchTerm%";
            $params[] = $like; $params[] = $like; $params[] = $like; $params[] = $like;
        }

        return [
            'join' => $join,
            'where' => implode(" AND ", $where),
            'params' => $params,
            'groupBy' => "",
            'orderBy' => "ORDER BY 
                            CASE WHEN c.grade = 'A' THEN 1 WHEN c.grade = 'B' THEN 2 WHEN c.grade = 'C' THEN 3 ELSE 4 END ASC,
                            c.date_registered ASC"
        ];
    }

    /**
     * Get Query Parts for 'All' (General Pool)
     */
    public static function getGeneralPoolParts($companyId, $searchTerm = '') {
        $params = [$companyId];
        
        // Optimized: Use LEFT JOIN derived table instead of Correlated Subquery for performance
        $join = "LEFT JOIN (
                    SELECT o.customer_id, COUNT(*) as ns_count
                    FROM orders o 
                    JOIN users u ON u.id = o.creator_id
                    WHERE (u.role = 'Admin Page' OR o.sales_channel IS NOT NULL)
                      AND o.order_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                    GROUP BY o.customer_id
                 ) ns ON ns.customer_id = c.customer_id";
        
        $where = [
            "c.company_id = ?",
            "COALESCE(c.is_blocked,0) = 0",
            "c.assigned_to IS NULL",
            "COALESCE(c.is_in_waiting_basket,0) = 0",
            "(c.last_follow_up_date IS NULL OR c.last_follow_up_date < DATE_SUB(NOW(), INTERVAL 7 DAY))"
        ];

        if ($searchTerm !== '') {
            $where[] = "(c.first_name LIKE ? OR c.last_name LIKE ? OR c.phone LIKE ? OR c.customer_id LIKE ?)";
            $like = "%$searchTerm%";
            $params[] = $like; $params[] = $like; $params[] = $like; $params[] = $like;
        }

        return [
            'join' => $join,
            'where' => implode(" AND ", $where),
            'params' => $params,
            'groupBy' => "",
            'orderBy' => "ORDER BY (
                            (COALESCE(ns.ns_count, 0) * 100000) +
                            (CASE WHEN c.grade = 'A' THEN 50000 WHEN c.grade = 'B' THEN 10000 ELSE 0 END) +
                            (CASE WHEN c.date_registered > DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1000 ELSE 0 END)
                          ) DESC, c.date_registered DESC"
        ];
    }
}
