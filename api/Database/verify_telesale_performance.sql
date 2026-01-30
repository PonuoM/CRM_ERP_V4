-- =============================================================
-- TELESALE PERFORMANCE VERIFICATION SCRIPT (V2)
-- ใช้ตรวจสอบความถูกต้องของข้อมูลใน Dashboard เทียบกับ Database โดยตรง
-- =============================================================
-- 🔄 V2: ใช้ order_items.creator_id แทน orders.creator_id
--        เพื่อแยกยอดขายที่ถูกต้องเมื่อมีการพ่วงขาย
-- =============================================================

SET @year = 2026;
SET @month = 1;
SET @telesale_id = NULL;  -- ใส่ user_id ถ้าต้องการดูรายคน หรือ NULL = ดูทั้งหมด

-- =============================================================
-- 1. ตรวจสอบจำนวนสาย (Total Calls)
-- =============================================================
SELECT 
    'จำนวนสาย (Total Calls)' AS metric,
    u.id AS user_id,
    u.first_name AS telesale_name,
    COUNT(l.id) AS total_calls,
    COALESCE(SUM(l.duration), 0) AS total_seconds,
    ROUND(COALESCE(SUM(l.duration), 0) / 60, 2) AS total_minutes,
    ROUND(COALESCE(SUM(l.duration), 0) / 60 / NULLIF(COUNT(l.id), 0), 2) AS aht_minutes
FROM users u
LEFT JOIN onecall_log l ON l.phone_telesale = u.phone 
    AND YEAR(l.timestamp) = @year 
    AND MONTH(l.timestamp) = @month
WHERE u.role LIKE '%telesale%'
    AND u.status = 'active'
    AND (@telesale_id IS NULL OR u.id = @telesale_id)
GROUP BY u.id, u.first_name
ORDER BY total_calls DESC;

-- =============================================================
-- 2. ตรวจสอบยอดขาย (Total Sales) - ใช้ order_items.creator_id
--    ⚠️ แยกยอดพ่วงถูกต้อง: นับเฉพาะที่ Telesale คนนี้สร้าง
-- =============================================================
SELECT 
    'ยอดขาย (Total Sales)' AS metric,
    u.id AS user_id,
    u.first_name AS telesale_name,
    COUNT(DISTINCT oi.parent_order_id) AS total_orders,
    COALESCE(SUM(oi.quantity * oi.price_per_unit), 0) AS total_sales,
    ROUND(COALESCE(SUM(oi.quantity * oi.price_per_unit), 0) / NULLIF(COUNT(DISTINCT oi.parent_order_id), 0), 2) AS avg_order_value
FROM users u
LEFT JOIN order_items oi ON oi.creator_id = u.id
LEFT JOIN orders o ON oi.parent_order_id = o.id 
    AND YEAR(o.order_date) = @year 
    AND MONTH(o.order_date) = @month
    AND o.order_status NOT IN ('Cancelled')
WHERE u.role LIKE '%telesale%'
    AND u.status = 'active'
    AND (oi.is_freebie = 0 OR oi.is_freebie IS NULL)
    AND (@telesale_id IS NULL OR u.id = @telesale_id)
GROUP BY u.id, u.first_name
ORDER BY total_sales DESC;

-- =============================================================
-- 3. ตรวจสอบ Conversion Rate (สาย → ออเดอร์)
-- =============================================================
SELECT 
    'Conversion Rate' AS metric,
    u.id AS user_id,
    u.first_name AS telesale_name,
    COALESCE(calls.total_calls, 0) AS total_calls,
    COALESCE(orders.total_orders, 0) AS total_orders,
    CASE 
        WHEN COALESCE(calls.total_calls, 0) = 0 THEN 0
        ELSE ROUND(COALESCE(orders.total_orders, 0) * 100.0 / calls.total_calls, 2)
    END AS conversion_rate_pct
FROM users u
LEFT JOIN (
    SELECT phone_telesale, COUNT(*) AS total_calls
    FROM onecall_log
    WHERE YEAR(timestamp) = @year AND MONTH(timestamp) = @month
    GROUP BY phone_telesale
) calls ON calls.phone_telesale = u.phone
LEFT JOIN (
    SELECT oi.creator_id, COUNT(DISTINCT oi.parent_order_id) AS total_orders
    FROM order_items oi
    JOIN orders o ON oi.parent_order_id = o.id
    WHERE YEAR(o.order_date) = @year AND MONTH(o.order_date) = @month
        AND o.order_status NOT IN ('Cancelled')
        AND (oi.is_freebie = 0 OR oi.is_freebie IS NULL)
    GROUP BY oi.creator_id
) orders ON orders.creator_id = u.id
WHERE u.role LIKE '%telesale%'
    AND u.status = 'active'
    AND (@telesale_id IS NULL OR u.id = @telesale_id)
ORDER BY conversion_rate_pct DESC;

-- =============================================================
-- 4. ตรวจสอบ Active Customers (ซื้อใน 90 วัน)
-- =============================================================
SELECT 
    'Active Customers' AS metric,
    u.id AS user_id,
    u.first_name AS telesale_name,
    COUNT(c.customer_id) AS total_customers,
    SUM(CASE 
        WHEN c.last_order_date >= DATE_SUB(CURDATE(), INTERVAL 90 DAY) THEN 1 
        ELSE 0 
    END) AS active_customers,
    ROUND(
        SUM(CASE WHEN c.last_order_date >= DATE_SUB(CURDATE(), INTERVAL 90 DAY) THEN 1 ELSE 0 END) 
        * 100.0 / NULLIF(COUNT(c.customer_id), 0), 2
    ) AS active_rate_pct
FROM users u
LEFT JOIN customers c ON c.assigned_to = u.id AND c.order_count >= 1
WHERE u.role LIKE '%telesale%'
    AND u.status = 'active'
    AND (@telesale_id IS NULL OR u.id = @telesale_id)
GROUP BY u.id, u.first_name
ORDER BY active_rate_pct DESC;

-- =============================================================
-- 5. ตรวจสอบ ลูกค้าซื้อซ้ำ (Loyalty) - V2: ใช้ order_items
--    ⚠️ นับลูกค้าที่ Telesale คนนี้ขายได้ > 1 ออเดอร์
--    ไม่นับถ้าเคยซื้อกับคนอื่นแต่ไม่ได้ซื้อกับเรา
-- =============================================================
SELECT 
    'ความภักดีลูกค้า (Loyalty) - จาก order_items' AS metric,
    u.id AS user_id,
    u.first_name AS telesale_name,
    COUNT(c.customer_id) AS total_customers,
    COALESCE(loyal.repeat_customers, 0) AS repeat_customers,
    ROUND(
        COALESCE(loyal.repeat_customers, 0) * 100.0 / NULLIF(COUNT(c.customer_id), 0), 2
    ) AS loyalty_rate_pct
FROM users u
LEFT JOIN customers c ON c.assigned_to = u.id AND c.order_count >= 1
LEFT JOIN (
    -- Subquery: นับลูกค้าที่ซื้อจาก Telesale คนนี้มากกว่า 1 ออเดอร์
    SELECT 
        oi.creator_id,
        COUNT(DISTINCT o.customer_id) AS repeat_customers
    FROM order_items oi
    JOIN orders o ON oi.parent_order_id = o.id
    WHERE o.order_status NOT IN ('Cancelled')
        AND (oi.is_freebie = 0 OR oi.is_freebie IS NULL)
    GROUP BY oi.creator_id, o.customer_id
    HAVING COUNT(DISTINCT o.id) > 1
) loyal ON loyal.creator_id = u.id
WHERE u.role LIKE '%telesale%'
    AND u.status = 'active'
    AND (@telesale_id IS NULL OR u.id = @telesale_id)
GROUP BY u.id, u.first_name, loyal.repeat_customers
ORDER BY loyalty_rate_pct DESC;

-- =============================================================
-- 6. [Corrected] ตรวจสอบ ลูกค้าซื้อซ้ำ V2 (Accurate Count)
-- =============================================================
SELECT  
    'ความภักดีลูกค้า (V2 Accurate)' AS metric,
    u.id AS user_id,
    u.first_name AS telesale_name,
    COALESCE(loyal_count.repeat_customers, 0) AS repeat_customers
FROM users u
LEFT JOIN (
    SELECT 
        creator_id,
        COUNT(*) AS repeat_customers
    FROM (
        SELECT 
            oi.creator_id,
            o.customer_id,
            COUNT(DISTINCT o.id) AS orders_count
        FROM order_items oi
        JOIN orders o ON oi.parent_order_id = o.id
        WHERE o.order_status NOT IN ('Cancelled')
            AND (oi.is_freebie = 0 OR oi.is_freebie IS NULL)
        GROUP BY oi.creator_id, o.customer_id
        HAVING COUNT(DISTINCT o.id) > 1
    ) AS customer_orders
    GROUP BY creator_id
) loyal_count ON loyal_count.creator_id = u.id
WHERE u.role LIKE '%telesale%'
    AND u.status = 'active'
    AND (@telesale_id IS NULL OR u.id = @telesale_id)
ORDER BY repeat_customers DESC;

-- =============================================================
-- 7. ตรวจสอบ TIER: ลูกค้าประจำ Core (current_basket_key 39, 40)
-- =============================================================
SELECT 
    'TIER: ลูกค้าประจำ (Core)' AS metric,
    u.id AS user_id,
    u.first_name AS telesale_name,
    COUNT(c.customer_id) AS core_total,
    SUM(CASE WHEN c.last_order_date >= DATE_SUB(CURDATE(), INTERVAL 90 DAY) THEN 1 ELSE 0 END) AS core_active,
    ROUND(
        SUM(CASE WHEN c.last_order_date >= DATE_SUB(CURDATE(), INTERVAL 90 DAY) THEN 1 ELSE 0 END) 
        * 100.0 / NULLIF(COUNT(c.customer_id), 0), 2
    ) AS core_active_rate_pct
FROM users u
LEFT JOIN customers c ON c.assigned_to = u.id AND c.current_basket_key IN (39, 40)
WHERE u.role LIKE '%telesale%'
    AND u.status = 'active'
    AND (@telesale_id IS NULL OR u.id = @telesale_id)
GROUP BY u.id, u.first_name
ORDER BY core_active_rate_pct DESC;

-- =============================================================
-- 8. ตรวจสอบ TIER: ลูกค้าใหม่ (current_basket_key 38, 41)
-- =============================================================
SELECT 
    'TIER: ลูกค้าใหม่ (New)' AS metric,
    u.id AS user_id,
    u.first_name AS telesale_name,
    COUNT(c.customer_id) AS new_total,
    SUM(CASE WHEN c.order_count > 0 THEN 1 ELSE 0 END) AS new_converted,
    ROUND(
        SUM(CASE WHEN c.order_count > 0 THEN 1 ELSE 0 END) 
        * 100.0 / NULLIF(COUNT(c.customer_id), 0), 2
    ) AS new_conversion_rate_pct
FROM users u
LEFT JOIN customers c ON c.assigned_to = u.id AND c.current_basket_key IN (38, 41)
WHERE u.role LIKE '%telesale%'
    AND u.status = 'active'
    AND (@telesale_id IS NULL OR u.id = @telesale_id)
GROUP BY u.id, u.first_name
ORDER BY new_conversion_rate_pct DESC;

-- =============================================================
-- 9. ตรวจสอบ TIER: กู้ชีพ Revival (current_basket_key 43, 44, 45)
-- =============================================================
SELECT 
    'TIER: กู้ชีพ (Revival)' AS metric,
    u.id AS user_id,
    u.first_name AS telesale_name,
    COUNT(c.customer_id) AS revival_total,
    SUM(CASE 
        WHEN EXISTS (
            SELECT 1 FROM orders o 
            WHERE o.customer_id = c.customer_id 
            AND YEAR(o.order_date) = @year 
            AND MONTH(o.order_date) = @month
            AND o.order_status NOT IN ('Cancelled')
        ) THEN 1 ELSE 0 
    END) AS revival_count
FROM users u
LEFT JOIN customers c ON c.assigned_to = u.id AND c.current_basket_key IN (43, 44, 45)
WHERE u.role LIKE '%telesale%'
    AND u.status = 'active'
    AND (@telesale_id IS NULL OR u.id = @telesale_id)
GROUP BY u.id, u.first_name
ORDER BY revival_count DESC;

-- =============================================================
-- 10. SUMMARY: ภาพรวมทีมทั้งหมด
-- =============================================================
SELECT 
    'TEAM SUMMARY (V2)' AS metric,
    (SELECT COUNT(DISTINCT u.id) FROM users u WHERE u.role LIKE '%telesale%' AND u.status = 'active') AS total_telesales,
    (SELECT COUNT(*) FROM onecall_log WHERE YEAR(timestamp) = @year AND MONTH(timestamp) = @month) AS total_calls,
    (SELECT COUNT(DISTINCT oi.parent_order_id) 
     FROM order_items oi 
     JOIN orders o ON oi.parent_order_id = o.id 
     WHERE YEAR(o.order_date) = @year AND MONTH(o.order_date) = @month 
       AND o.order_status NOT IN ('Cancelled')
       AND (oi.is_freebie = 0 OR oi.is_freebie IS NULL)
    ) AS total_orders,
    (SELECT SUM(oi.quantity * oi.price_per_unit) 
     FROM order_items oi 
     JOIN orders o ON oi.parent_order_id = o.id 
     WHERE YEAR(o.order_date) = @year AND MONTH(o.order_date) = @month 
       AND o.order_status NOT IN ('Cancelled')
       AND (oi.is_freebie = 0 OR oi.is_freebie IS NULL)
    ) AS total_sales,
    (SELECT COUNT(*) FROM customers WHERE current_basket_key IN (39, 40)) AS core_customers,
    (SELECT COUNT(*) FROM customers WHERE current_basket_key IN (38, 41)) AS new_customers,
    (SELECT COUNT(*) FROM customers WHERE current_basket_key IN (43, 44, 45)) AS revival_customers;

-- =============================================================
-- QUICK CHECK: ดูข้อมูล Telesale คนใดคนหนึ่ง
-- =============================================================
SET @check_user_id = 100;  -- เปลี่ยนเป็น user_id ที่ต้องการตรวจสอบ

SELECT 
    u.id,
    u.first_name,
    u.last_name,
    u.role,
    u.phone,
    (SELECT COUNT(*) FROM onecall_log WHERE phone_telesale = u.phone AND YEAR(timestamp) = @year AND MONTH(timestamp) = @month) AS calls_this_month,
    (SELECT COUNT(DISTINCT oi.parent_order_id) 
     FROM order_items oi 
     JOIN orders o ON oi.parent_order_id = o.id 
     WHERE oi.creator_id = u.id 
       AND YEAR(o.order_date) = @year AND MONTH(o.order_date) = @month 
       AND o.order_status NOT IN ('Cancelled')
       AND (oi.is_freebie = 0 OR oi.is_freebie IS NULL)
    ) AS orders_this_month,
    (SELECT COALESCE(SUM(oi.quantity * oi.price_per_unit), 0) 
     FROM order_items oi 
     JOIN orders o ON oi.parent_order_id = o.id 
     WHERE oi.creator_id = u.id 
       AND YEAR(o.order_date) = @year AND MONTH(o.order_date) = @month 
       AND o.order_status NOT IN ('Cancelled')
       AND (oi.is_freebie = 0 OR oi.is_freebie IS NULL)
    ) AS sales_this_month,
    (SELECT COUNT(*) FROM customers WHERE assigned_to = u.id) AS total_customers,
    (SELECT COUNT(*) FROM customers WHERE assigned_to = u.id AND current_basket_key IN (39, 40)) AS core_customers,
    (SELECT COUNT(*) FROM customers WHERE assigned_to = u.id AND current_basket_key IN (38, 41)) AS new_customers,
    (SELECT COUNT(*) FROM customers WHERE assigned_to = u.id AND current_basket_key IN (43, 44, 45)) AS revival_customers
FROM users u
WHERE u.id = @check_user_id;
