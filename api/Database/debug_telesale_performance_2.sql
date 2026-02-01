-- ============================================
-- DEBUG 2: ตรวจสอบ net_total vs quantity * price_per_unit
-- ============================================

-- =============================================
-- 1. เปรียบเทียบ gross vs net
-- =============================================
SELECT 
    u.id AS user_id,
    u.first_name,
    SUM(oi.quantity * oi.price_per_unit) AS gross_sales,
    SUM(COALESCE(oi.net_total, oi.quantity * oi.price_per_unit)) AS net_sales,
    SUM(oi.quantity * oi.price_per_unit) - SUM(COALESCE(oi.net_total, oi.quantity * oi.price_per_unit)) AS discount_amount
FROM users u
JOIN orders o ON o.creator_id = u.id
    AND o.company_id = 1
    AND YEAR(o.order_date) = 2026 AND MONTH(o.order_date) = 1
    AND o.order_status NOT IN ('Cancelled', 'Returned', 'BadDebt')
JOIN order_items oi ON oi.parent_order_id = o.id
    AND (oi.is_freebie = 0 OR oi.is_freebie IS NULL)
WHERE u.id IN (24, 25, 26, 27)
GROUP BY u.id, u.first_name
ORDER BY net_sales DESC;

-- =============================================
-- 2. ยอด net_total เทียบกับยอดที่ถูกต้อง
-- =============================================
-- ยอดที่ถูกต้อง:
-- ปอนด์ (24): 324,201
-- แหวว (27): 312,133
-- น้ำ (26): 253,953
-- หนิง (25): 232,018
-- รวม: 1,122,305

SELECT 
    u.id AS user_id,
    u.first_name,
    SUM(COALESCE(oi.net_total, oi.quantity * oi.price_per_unit)) AS net_sales,
    CASE u.id
        WHEN 24 THEN 324201
        WHEN 27 THEN 312133
        WHEN 26 THEN 253953
        WHEN 25 THEN 232018
    END AS expected,
    SUM(COALESCE(oi.net_total, oi.quantity * oi.price_per_unit)) - 
    CASE u.id
        WHEN 24 THEN 324201
        WHEN 27 THEN 312133
        WHEN 26 THEN 253953
        WHEN 25 THEN 232018
    END AS difference
FROM users u
JOIN orders o ON o.creator_id = u.id
    AND o.company_id = 1
    AND YEAR(o.order_date) = 2026 AND MONTH(o.order_date) = 1
    AND o.order_status NOT IN ('Cancelled', 'Returned', 'BadDebt')
JOIN order_items oi ON oi.parent_order_id = o.id
    AND (oi.is_freebie = 0 OR oi.is_freebie IS NULL)
WHERE u.id IN (24, 25, 26, 27)
GROUP BY u.id, u.first_name
ORDER BY u.id;

-- =============================================
-- 3. ยอดแยกตาม order_status
--    ดูว่า status ไหนควรตัดออก
-- =============================================
SELECT 
    o.order_status,
    u.id AS user_id,
    u.first_name,
    COUNT(DISTINCT o.id) AS order_count,
    SUM(COALESCE(oi.net_total, oi.quantity * oi.price_per_unit)) AS net_sales
FROM users u
JOIN orders o ON o.creator_id = u.id
    AND o.company_id = 1
    AND YEAR(o.order_date) = 2026 AND MONTH(o.order_date) = 1
    AND o.order_status NOT IN ('Cancelled', 'Returned', 'BadDebt')
JOIN order_items oi ON oi.parent_order_id = o.id
    AND (oi.is_freebie = 0 OR oi.is_freebie IS NULL)
WHERE u.id IN (24, 25, 26, 27)
GROUP BY o.order_status, u.id, u.first_name
ORDER BY u.id, o.order_status;

-- =============================================
-- 4. ลองตัด Pending, PreApproved, Preparing ออก
--    (เผื่อว่าเป็น "draft" ที่ไม่ถูกนับ)
-- =============================================
SELECT 
    u.id AS user_id,
    u.first_name,
    SUM(COALESCE(oi.net_total, oi.quantity * oi.price_per_unit)) AS net_sales
FROM users u
JOIN orders o ON o.creator_id = u.id
    AND o.company_id = 1
    AND YEAR(o.order_date) = 2026 AND MONTH(o.order_date) = 1
    AND o.order_status IN ('Picking', 'Shipping', 'Delivered')
JOIN order_items oi ON oi.parent_order_id = o.id
    AND (oi.is_freebie = 0 OR oi.is_freebie IS NULL)
WHERE u.id IN (24, 25, 26, 27)
GROUP BY u.id, u.first_name
ORDER BY net_sales DESC;

-- =============================================
-- 5. ลองใช้เฉพาะ status: Draft, Picking, Closed
--    (ถ้า Draft = 'Draft' และ Closed = 'Closed')
-- =============================================
SELECT DISTINCT o.order_status
FROM orders o
WHERE o.company_id = 1
ORDER BY o.order_status;
