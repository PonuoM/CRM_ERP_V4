-- =============================================
-- 🔍 BASKET VALIDATION AUDIT
-- ตรวจสอบว่าลูกค้าอยู่ถังที่ถูกต้องตามกฎเกณฑ์
-- รันใน phpMyAdmin ทีละ query
-- วันที่: 2026-03-01
-- =============================================

-- =============================================
-- 0) สรุปภาพรวม: จำนวนลูกค้าในแต่ละถัง (Dashboard baskets)
-- =============================================
SELECT 
    c.current_basket_key AS basket_id,
    bc.basket_name,
    COUNT(*) AS total_customers
FROM customers c
LEFT JOIN basket_config bc ON bc.id = c.current_basket_key
WHERE c.assigned_to IS NOT NULL
  AND c.current_basket_key IN (38, 39, 40, 46, 47, 48, 49, 50, 51)
GROUP BY c.current_basket_key, bc.basket_name
ORDER BY c.current_basket_key;


-- =============================================
-- 1) ถัง 51 Upsell - ต้องมี order ล่าสุดจาก Admin (ไม่ใช่ Telesale role 6,7)
--    และ order_status = 'Pending'
--    ❌ ผิดถ้า: order ล่าสุดเป็นของ Telesale เอง หรือไม่มี Pending order
-- =============================================
SELECT 
    '51 Upsell' AS basket,
    c.customer_id,
    CONCAT(c.first_name, ' ', c.last_name) AS customer_name,
    c.assigned_to,
    o.id AS latest_order_id,
    o.order_date,
    o.order_status,
    o.creator_id,
    u.role AS creator_role,
    u.role_id AS creator_role_id,
    CASE 
        WHEN o.id IS NULL THEN '❌ ไม่มี order เลย'
        WHEN o.order_status != 'Pending' THEN CONCAT('❌ order_status = ', o.order_status, ' (ควรเป็น Pending)')
        WHEN u.role_id IN (6, 7) OR LOWER(u.role) IN ('telesale', 'supervisor telesale') THEN '❌ creator เป็น Telesale ไม่ใช่ Admin'
        ELSE '✅ ถูกต้อง'
    END AS validation
FROM customers c
LEFT JOIN (
    SELECT o1.* FROM orders o1
    INNER JOIN (
        SELECT customer_id, MAX(order_date) AS max_date
        FROM orders
        WHERE order_status NOT IN ('CANCELLED', 'RETURNED')
        GROUP BY customer_id
    ) o2 ON o1.customer_id = o2.customer_id AND o1.order_date = o2.max_date
) o ON o.customer_id = c.customer_id
LEFT JOIN users u ON o.creator_id = u.id
WHERE c.current_basket_key = 51
  AND c.assigned_to IS NOT NULL
HAVING validation LIKE '❌%'
ORDER BY o.order_date DESC;


-- =============================================
-- 2) ถัง 38 ลูกค้าใหม่ - order ล่าสุดจาก Admin page (ไม่ใช่ Telesale)
--    order_date อยู่ระหว่าง 1-60 วัน (จาก basket_config: 0-30 days + fail_after_days=60)
--    ❌ ผิดถ้า: order เกิดจาก Telesale เอง หรือ order เก่ากว่า 60 วัน
-- =============================================
SELECT 
    '38 ลูกค้าใหม่' AS basket,
    c.customer_id,
    CONCAT(c.first_name, ' ', c.last_name) AS customer_name,
    c.assigned_to,
    o.id AS latest_order_id,
    o.order_date,
    DATEDIFF(CURDATE(), o.order_date) AS days_since_order,
    o.creator_id,
    u.role AS creator_role,
    u.role_id AS creator_role_id,
    CASE 
        WHEN o.id IS NULL THEN '❌ ไม่มี order เลย'
        WHEN (u.role_id IN (6, 7) OR LOWER(u.role) IN ('telesale', 'supervisor telesale')) 
             AND o.creator_id = c.assigned_to THEN '❌ order จาก Telesale ตัวเอง (ควรอยู่ ถัง 39)'
        WHEN DATEDIFF(CURDATE(), o.order_date) > 60 THEN CONCAT('❌ order เก่า ', DATEDIFF(CURDATE(), o.order_date), ' วัน (เกิน 60 วัน)')
        ELSE '✅ ถูกต้อง'
    END AS validation
FROM customers c
LEFT JOIN (
    SELECT o1.* FROM orders o1
    INNER JOIN (
        SELECT customer_id, MAX(order_date) AS max_date
        FROM orders WHERE order_status NOT IN ('CANCELLED', 'RETURNED')
        GROUP BY customer_id
    ) o2 ON o1.customer_id = o2.customer_id AND o1.order_date = o2.max_date
) o ON o.customer_id = c.customer_id
LEFT JOIN users u ON o.creator_id = u.id
WHERE c.current_basket_key = 38
  AND c.assigned_to IS NOT NULL
HAVING validation LIKE '❌%'
ORDER BY days_since_order DESC;


-- =============================================
-- 3) ถัง 39 ส่วนตัว 1-2 เดือน - order จาก Telesale ตัวเอง
--    (assigned_to = creator_id) และ order_date 1-60 วัน
--    ❌ ผิดถ้า: order ไม่ได้จากเจ้าของ หรือ order เก่ากว่า 60 วัน
-- =============================================
SELECT 
    '39 ส่วนตัว 1-2 เดือน' AS basket,
    c.customer_id,
    CONCAT(c.first_name, ' ', c.last_name) AS customer_name,
    c.assigned_to,
    o.id AS latest_order_id,
    o.order_date,
    DATEDIFF(CURDATE(), o.order_date) AS days_since_order,
    o.creator_id,
    u.role AS creator_role,
    CASE 
        WHEN o.id IS NULL THEN '❌ ไม่มี order เลย'
        WHEN DATEDIFF(CURDATE(), o.order_date) > 60 THEN CONCAT('❌ order เก่า ', DATEDIFF(CURDATE(), o.order_date), ' วัน (ควรย้ายถัง 40)')
        WHEN o.creator_id != c.assigned_to THEN CONCAT('❌ creator_id=', o.creator_id, ' ≠ assigned_to=', c.assigned_to)
        ELSE '✅ ถูกต้อง'
    END AS validation
FROM customers c
LEFT JOIN (
    SELECT o1.* FROM orders o1
    INNER JOIN (
        SELECT customer_id, MAX(order_date) AS max_date
        FROM orders WHERE order_status NOT IN ('CANCELLED', 'RETURNED')
        GROUP BY customer_id
    ) o2 ON o1.customer_id = o2.customer_id AND o1.order_date = o2.max_date
) o ON o.customer_id = c.customer_id
LEFT JOIN users u ON o.creator_id = u.id
WHERE c.current_basket_key = 39
  AND c.assigned_to IS NOT NULL
HAVING validation LIKE '❌%'
ORDER BY days_since_order DESC;


-- =============================================
-- 4) ถัง 40 ส่วนตัวโอกาสสุดท้าย - order จาก Telesale ตัวเอง
--    (assigned_to = creator_id) และ order_date 61-90 วัน
--    ❌ ผิดถ้า: order ไม่ได้จากเจ้าของ หรือ วันไม่ตรง
-- =============================================
SELECT 
    '40 โอกาสสุดท้าย' AS basket,
    c.customer_id,
    CONCAT(c.first_name, ' ', c.last_name) AS customer_name,
    c.assigned_to,
    o.id AS latest_order_id,
    o.order_date,
    DATEDIFF(CURDATE(), o.order_date) AS days_since_order,
    o.creator_id,
    CASE 
        WHEN o.id IS NULL THEN '❌ ไม่มี order เลย'
        WHEN DATEDIFF(CURDATE(), o.order_date) < 61 THEN CONCAT('❌ order ใหม่เกิน ', DATEDIFF(CURDATE(), o.order_date), ' วัน (ควรอยู่ ถัง 39)')
        WHEN DATEDIFF(CURDATE(), o.order_date) > 90 THEN CONCAT('❌ order เก่า ', DATEDIFF(CURDATE(), o.order_date), ' วัน (ควรย้ายออก)')
        WHEN o.creator_id != c.assigned_to THEN CONCAT('❌ creator_id=', o.creator_id, ' ≠ assigned_to=', c.assigned_to)
        ELSE '✅ ถูกต้อง'
    END AS validation
FROM customers c
LEFT JOIN (
    SELECT o1.* FROM orders o1
    INNER JOIN (
        SELECT customer_id, MAX(order_date) AS max_date
        FROM orders WHERE order_status NOT IN ('CANCELLED', 'RETURNED')
        GROUP BY customer_id
    ) o2 ON o1.customer_id = o2.customer_id AND o1.order_date = o2.max_date
) o ON o.customer_id = c.customer_id
LEFT JOIN users u ON o.creator_id = u.id
WHERE c.current_basket_key = 40
  AND c.assigned_to IS NOT NULL
HAVING validation LIKE '❌%'
ORDER BY days_since_order DESC;


-- =============================================
-- 5) ถัง 46 หาคนดูแลใหม่ (Dashboard) - order จาก Telesale ที่ไม่ใช่ตัวเอง
--    order 91-180 วัน
--    ❌ ผิดถ้า: order จาก Non-Telesale หรือ จาก Telesale ตัวเอง หรือ วันไม่ตรง
-- =============================================
SELECT 
    '46 หาคนดูแลใหม่' AS basket,
    c.customer_id,
    CONCAT(c.first_name, ' ', c.last_name) AS customer_name,
    c.assigned_to,
    o.id AS latest_order_id,
    o.order_date,
    DATEDIFF(CURDATE(), o.order_date) AS days_since_order,
    o.creator_id,
    u.role AS creator_role,
    u.role_id AS creator_role_id,
    CASE 
        WHEN o.id IS NULL THEN '❌ ไม่มี order เลย'
        WHEN DATEDIFF(CURDATE(), o.order_date) < 91 THEN CONCAT('❌ order ใหม่เกิน ', DATEDIFF(CURDATE(), o.order_date), ' วัน (ควรอยู่ 47)')
        WHEN DATEDIFF(CURDATE(), o.order_date) > 180 THEN CONCAT('❌ order เก่า ', DATEDIFF(CURDATE(), o.order_date), ' วัน (ควรอยู่ 48)')
        ELSE '✅ ถูกต้อง'
    END AS validation
FROM customers c
LEFT JOIN (
    SELECT o1.* FROM orders o1
    INNER JOIN (
        SELECT customer_id, MAX(order_date) AS max_date
        FROM orders WHERE order_status NOT IN ('CANCELLED', 'RETURNED')
        GROUP BY customer_id
    ) o2 ON o1.customer_id = o2.customer_id AND o1.order_date = o2.max_date
) o ON o.customer_id = c.customer_id
LEFT JOIN users u ON o.creator_id = u.id
WHERE c.current_basket_key = 46
  AND c.assigned_to IS NOT NULL
HAVING validation LIKE '❌%'
ORDER BY days_since_order DESC;


-- =============================================
-- 6) ถัง 47 รอคนมาจีบให้ติด (Dashboard) - order จาก Telesale ที่ไม่ใช่ตัวเอง
--    order 1-90 วัน (basket_config max_days_since_order = 180)
--    ❌ ผิดถ้า: order เก่ากว่า 180 วัน
-- =============================================
SELECT 
    '47 รอคนมาจีบ' AS basket,
    c.customer_id,
    CONCAT(c.first_name, ' ', c.last_name) AS customer_name,
    c.assigned_to,
    o.id AS latest_order_id,
    o.order_date,
    DATEDIFF(CURDATE(), o.order_date) AS days_since_order,
    o.creator_id,
    u.role AS creator_role,
    CASE 
        WHEN o.id IS NULL THEN '❌ ไม่มี order เลย'
        WHEN DATEDIFF(CURDATE(), o.order_date) > 180 THEN CONCAT('❌ order เก่า ', DATEDIFF(CURDATE(), o.order_date), ' วัน (เกิน 180)')
        ELSE '✅ ถูกต้อง'
    END AS validation
FROM customers c
LEFT JOIN (
    SELECT o1.* FROM orders o1
    INNER JOIN (
        SELECT customer_id, MAX(order_date) AS max_date
        FROM orders WHERE order_status NOT IN ('CANCELLED', 'RETURNED')
        GROUP BY customer_id
    ) o2 ON o1.customer_id = o2.customer_id AND o1.order_date = o2.max_date
) o ON o.customer_id = c.customer_id
LEFT JOIN users u ON o.creator_id = u.id
WHERE c.current_basket_key = 47
  AND c.assigned_to IS NOT NULL
HAVING validation LIKE '❌%'
ORDER BY days_since_order DESC;


-- =============================================
-- 7) ถัง 48 ถังกลาง 6-12 เดือน - order ล่าสุด 181-365 วัน
-- =============================================
SELECT 
    '48 กลาง 6-12m' AS basket,
    c.customer_id,
    CONCAT(c.first_name, ' ', c.last_name) AS customer_name,
    c.assigned_to,
    o.order_date,
    DATEDIFF(CURDATE(), o.order_date) AS days_since_order,
    CASE 
        WHEN o.id IS NULL THEN '❌ ไม่มี order เลย'
        WHEN DATEDIFF(CURDATE(), o.order_date) < 181 THEN CONCAT('❌ order ใหม่เกิน ', DATEDIFF(CURDATE(), o.order_date), ' วัน')
        WHEN DATEDIFF(CURDATE(), o.order_date) > 365 THEN CONCAT('❌ order เก่า ', DATEDIFF(CURDATE(), o.order_date), ' วัน (ควรอยู่ 49)')
        ELSE '✅ ถูกต้อง'
    END AS validation
FROM customers c
LEFT JOIN (
    SELECT o1.* FROM orders o1
    INNER JOIN (
        SELECT customer_id, MAX(order_date) AS max_date
        FROM orders WHERE order_status NOT IN ('CANCELLED', 'RETURNED')
        GROUP BY customer_id
    ) o2 ON o1.customer_id = o2.customer_id AND o1.order_date = o2.max_date
) o ON o.customer_id = c.customer_id
WHERE c.current_basket_key = 48
  AND c.assigned_to IS NOT NULL
HAVING validation LIKE '❌%'
ORDER BY days_since_order DESC;


-- =============================================
-- 8) ถัง 49 ถังกลาง 1-3 ปี - order ล่าสุด 366-1095 วัน
-- =============================================
SELECT 
    '49 กลาง 1-3y' AS basket,
    c.customer_id,
    CONCAT(c.first_name, ' ', c.last_name) AS customer_name,
    c.assigned_to,
    o.order_date,
    DATEDIFF(CURDATE(), o.order_date) AS days_since_order,
    CASE 
        WHEN o.id IS NULL THEN '❌ ไม่มี order เลย'
        WHEN DATEDIFF(CURDATE(), o.order_date) < 366 THEN CONCAT('❌ order ใหม่เกิน ', DATEDIFF(CURDATE(), o.order_date), ' วัน')
        WHEN DATEDIFF(CURDATE(), o.order_date) > 1095 THEN CONCAT('❌ order เก่า ', DATEDIFF(CURDATE(), o.order_date), ' วัน (ควรอยู่ 50)')
        ELSE '✅ ถูกต้อง'
    END AS validation
FROM customers c
LEFT JOIN (
    SELECT o1.* FROM orders o1
    INNER JOIN (
        SELECT customer_id, MAX(order_date) AS max_date
        FROM orders WHERE order_status NOT IN ('CANCELLED', 'RETURNED')
        GROUP BY customer_id
    ) o2 ON o1.customer_id = o2.customer_id AND o1.order_date = o2.max_date
) o ON o.customer_id = c.customer_id
WHERE c.current_basket_key = 49
  AND c.assigned_to IS NOT NULL
HAVING validation LIKE '❌%'
ORDER BY days_since_order DESC;


-- =============================================
-- 9) ถัง 50 ถังโบราณ - order ล่าสุด > 1096 วัน
-- =============================================
SELECT 
    '50 โบราณ' AS basket,
    c.customer_id,
    CONCAT(c.first_name, ' ', c.last_name) AS customer_name,
    c.assigned_to,
    o.order_date,
    DATEDIFF(CURDATE(), o.order_date) AS days_since_order,
    CASE 
        WHEN o.id IS NULL THEN '❌ ไม่มี order เลย'
        WHEN DATEDIFF(CURDATE(), o.order_date) < 1096 THEN CONCAT('❌ order ใหม่เกิน ', DATEDIFF(CURDATE(), o.order_date), ' วัน (ยังไม่ควรถังโบราณ)')
        ELSE '✅ ถูกต้อง'
    END AS validation
FROM customers c
LEFT JOIN (
    SELECT o1.* FROM orders o1
    INNER JOIN (
        SELECT customer_id, MAX(order_date) AS max_date
        FROM orders WHERE order_status NOT IN ('CANCELLED', 'RETURNED')
        GROUP BY customer_id
    ) o2 ON o1.customer_id = o2.customer_id AND o1.order_date = o2.max_date
) o ON o.customer_id = c.customer_id
WHERE c.current_basket_key = 50
  AND c.assigned_to IS NOT NULL
HAVING validation LIKE '❌%'
ORDER BY days_since_order DESC;


-- =============================================
-- 10) 🔥 สรุปรวม: จำนวนลูกค้าที่อยู่ผิดถังในแต่ละถัง
-- =============================================
SELECT 
    c.current_basket_key AS basket_id,
    bc.basket_name,
    COUNT(*) AS total_in_basket,
    SUM(CASE 
        -- ถัง 39: ผิดถ้า order เก่ากว่า 60 วัน
        WHEN c.current_basket_key = 39 AND DATEDIFF(CURDATE(), latest_o.max_date) > 60 THEN 1
        -- ถัง 40: ผิดถ้า order < 61 วัน หรือ > 90 วัน  
        WHEN c.current_basket_key = 40 AND (DATEDIFF(CURDATE(), latest_o.max_date) < 61 OR DATEDIFF(CURDATE(), latest_o.max_date) > 90) THEN 1
        -- ถัง 46: ผิดถ้า order < 91 วัน หรือ > 180 วัน
        WHEN c.current_basket_key = 46 AND (DATEDIFF(CURDATE(), latest_o.max_date) < 91 OR DATEDIFF(CURDATE(), latest_o.max_date) > 180) THEN 1
        -- ถัง 47: ผิดถ้า order > 180 วัน
        WHEN c.current_basket_key = 47 AND DATEDIFF(CURDATE(), latest_o.max_date) > 180 THEN 1
        -- ถัง 48: ผิดถ้า order < 181 วัน หรือ > 365 วัน
        WHEN c.current_basket_key = 48 AND (DATEDIFF(CURDATE(), latest_o.max_date) < 181 OR DATEDIFF(CURDATE(), latest_o.max_date) > 365) THEN 1
        -- ถัง 49: ผิดถ้า order < 366 วัน หรือ > 1095 วัน
        WHEN c.current_basket_key = 49 AND (DATEDIFF(CURDATE(), latest_o.max_date) < 366 OR DATEDIFF(CURDATE(), latest_o.max_date) > 1095) THEN 1
        -- ถัง 50: ผิดถ้า order < 1096 วัน
        WHEN c.current_basket_key = 50 AND DATEDIFF(CURDATE(), latest_o.max_date) < 1096 THEN 1
        ELSE 0
    END) AS wrong_basket_count
FROM customers c
LEFT JOIN (
    SELECT customer_id, MAX(order_date) AS max_date
    FROM orders 
    WHERE order_status NOT IN ('CANCELLED', 'RETURNED')
    GROUP BY customer_id
) latest_o ON latest_o.customer_id = c.customer_id
LEFT JOIN basket_config bc ON bc.id = c.current_basket_key
WHERE c.assigned_to IS NOT NULL
  AND c.current_basket_key IN (38, 39, 40, 46, 47, 48, 49, 50, 51)
GROUP BY c.current_basket_key, bc.basket_name
ORDER BY c.current_basket_key;


-- =============================================
-- 11) 🔥 ผลกระทบจาก role_id = NULL bug 
--     ตรวจสอบว่ามี order ไหนที่ถูก route ผิดเพราะ Telesale ถูกมองเป็น Admin
-- =============================================
SELECT 
    btl.customer_id,
    btl.from_basket_key,
    btl.to_basket_key,
    btl.transition_type,
    btl.order_id,
    btl.notes,
    btl.created_at,
    o.creator_id,
    u.username,
    u.role,
    u.role_id,
    c.current_basket_key AS current_basket_now,
    c.assigned_to
FROM basket_transition_log btl
JOIN orders o ON btl.order_id = o.id
JOIN users u ON o.creator_id = u.id
LEFT JOIN customers c ON c.customer_id = btl.customer_id
WHERE u.role_id IS NULL
  AND u.role IN ('Telesale', 'Supervisor Telesale')
  AND btl.transition_type LIKE 'pending_admin%'
ORDER BY btl.created_at DESC
LIMIT 100;
