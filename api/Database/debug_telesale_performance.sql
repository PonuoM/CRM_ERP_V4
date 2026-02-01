-- ============================================
-- DEBUG: ปัญหา LEFT JOIN ใน Telesale Performance
-- =============================================
-- ยอดที่ถูก (จากรูป 2):
-- ปอน (24): ฿324,201
-- แหวว (27): ฿312,133  
-- น้ำ (26): ฿253,953
-- หนิง (25): ฿232,018
--
-- ยอดที่ผิด (จากรูป 1):
-- ปอน (24): ฿399,970  (+75,769)
-- แหวว (27): ฿369,495  (+57,362)
-- น้ำ (26): ฿302,620  (+48,667)
-- หนิง (25): ฿280,450  (+48,432)
-- ============================================

-- =============================================
-- 1. Query ที่ถูกต้อง (Product Analysis style - INNER JOIN)
-- =============================================
SELECT 
    u.id AS user_id,
    u.first_name,
    COUNT(DISTINCT o.id) AS total_orders,
    SUM(oi.quantity * oi.price_per_unit) AS total_sales
FROM users u
JOIN orders o ON o.creator_id = u.id
    AND o.company_id = 1
    AND YEAR(o.order_date) = 2026 AND MONTH(o.order_date) = 1
    AND o.order_status NOT IN ('Cancelled', 'Returned', 'BadDebt')
JOIN order_items oi ON oi.parent_order_id = o.id
    AND (oi.is_freebie = 0 OR oi.is_freebie IS NULL)
WHERE u.id IN (24, 25, 26, 27)
GROUP BY u.id, u.first_name
ORDER BY total_sales DESC;

-- =============================================
-- 2. Query ที่ telesale_performance.php ใช้ (LEFT JOIN)
--    ปัญหา: LEFT JOIN condition ไม่กรอง order_items
-- =============================================
SELECT 
    u.id AS user_id,
    u.first_name,
    COUNT(DISTINCT o.id) AS total_orders,
    COALESCE(SUM(oi.quantity * oi.price_per_unit), 0) AS total_sales
FROM users u
LEFT JOIN orders o ON o.creator_id = u.id
    AND o.company_id = 1
    AND YEAR(o.order_date) = 2026 AND MONTH(o.order_date) = 1
    AND o.order_status NOT IN ('Cancelled', 'Returned', 'BadDebt')
LEFT JOIN order_items oi ON oi.parent_order_id = o.id
    AND (oi.is_freebie = 0 OR oi.is_freebie IS NULL)
WHERE u.id IN (24, 25, 26, 27)
GROUP BY u.id, u.first_name
ORDER BY total_sales DESC;

-- =============================================
-- 3. ตรวจสอบ: มี order ที่ไม่ใช่เดือน 1/2026 
--    มาปนอยู่หรือไม่?
-- =============================================
SELECT 
    YEAR(o.order_date) AS year,
    MONTH(o.order_date) AS month,
    o.order_status,
    u.id AS user_id,
    u.first_name,
    COUNT(DISTINCT o.id) AS order_count,
    SUM(oi.quantity * oi.price_per_unit) AS total_sales
FROM users u
LEFT JOIN orders o ON o.creator_id = u.id
    AND o.company_id = 1
LEFT JOIN order_items oi ON oi.parent_order_id = o.id
    AND (oi.is_freebie = 0 OR oi.is_freebie IS NULL)
WHERE u.id IN (24, 25, 26, 27) 
    AND o.order_status NOT IN ('Cancelled', 'Returned', 'BadDebt')
GROUP BY YEAR(o.order_date), MONTH(o.order_date), o.order_status, u.id, u.first_name
ORDER BY u.id, year, month;

-- =============================================
-- 4. ดูว่ามี order_items ที่ parent_order 
--    ถูกกรองออกแต่ยังโดนนับหรือไม่
-- =============================================
SELECT 
    'Orders in Jan 2026' AS description,
    u.id AS user_id,
    u.first_name,
    COUNT(DISTINCT o.id) AS order_count,
    SUM(oi.quantity * oi.price_per_unit) AS total_sales
FROM users u
JOIN orders o ON o.creator_id = u.id
JOIN order_items oi ON oi.parent_order_id = o.id
WHERE u.id IN (24, 25, 26, 27)
    AND o.company_id = 1
    AND YEAR(o.order_date) = 2026 AND MONTH(o.order_date) = 1
    AND o.order_status NOT IN ('Cancelled', 'Returned', 'BadDebt')
    AND (oi.is_freebie = 0 OR oi.is_freebie IS NULL)
GROUP BY u.id, u.first_name;

-- =============================================
-- 5. ตรวจ order ที่มี order_status ผิดปกติ
-- =============================================
SELECT 
    o.order_status,
    COUNT(DISTINCT o.id) AS count,
    SUM(oi.quantity * oi.price_per_unit) AS total
FROM orders o
JOIN order_items oi ON oi.parent_order_id = o.id
    AND (oi.is_freebie = 0 OR oi.is_freebie IS NULL)
WHERE o.company_id = 1
    AND YEAR(o.order_date) = 2026 AND MONTH(o.order_date) = 1
    AND o.creator_id IN (24, 25, 26, 27)
GROUP BY o.order_status
ORDER BY o.order_status;

-- =============================================
-- 6. ยอดรวมที่ถูกต้องควรประมาณ 1.12M (4 คน)
--    324201 + 312133 + 253953 + 232018 = 1,122,305
-- =============================================
SELECT 324201 + 312133 + 253953 + 232018 AS expected_total;
