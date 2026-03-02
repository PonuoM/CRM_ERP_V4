-- =============================================
-- 🔧 BASKET FIX SCRIPT
-- แก้ไขลูกค้าที่อยู่ผิดถัง (เกิดจาก monthly_cron fallback bug)
-- รันใน phpMyAdmin ทีละ query
-- วันที่: 2026-03-01
-- =============================================
-- ⚠️ ขั้นตอน:
-- 1. รัน DRY RUN ทุกอัน ก่อน เพื่อดูผลลัพธ์
-- 2. ถ้า DRY RUN ถูกต้อง ค่อยรัน FIX queries
-- 3. รันทีละ query อย่ารันทั้งหมดพร้อมกัน
-- =============================================


-- =============================================
-- DRY RUN 1: ดูภาพรวมว่าจะต้องย้ายกี่คน ไปถังไหนบ้าง
-- (เป็นแค่ SELECT ไม่แก้ข้อมูล)
-- =============================================
SELECT 
    c.current_basket_key AS current_basket,
    bc_from.basket_name AS from_basket_name,
    CASE
        WHEN days_calc.days_since_order BETWEEN 0 AND 60 
             AND latest_order.creator_id = c.assigned_to THEN 39
        WHEN days_calc.days_since_order BETWEEN 0 AND 60 
             AND (latest_order.creator_id != c.assigned_to OR c.assigned_to IS NULL) THEN 47
        WHEN days_calc.days_since_order BETWEEN 61 AND 90 
             AND latest_order.creator_id = c.assigned_to THEN 40
        WHEN days_calc.days_since_order BETWEEN 61 AND 90 
             AND (latest_order.creator_id != c.assigned_to OR c.assigned_to IS NULL) THEN 47
        WHEN days_calc.days_since_order BETWEEN 91 AND 180 THEN 46
        WHEN days_calc.days_since_order BETWEEN 181 AND 365 THEN 48
        WHEN days_calc.days_since_order BETWEEN 366 AND 1095 THEN 49
        WHEN days_calc.days_since_order >= 1096 THEN 50
        ELSE NULL
    END AS should_be_basket,
    COUNT(*) AS customer_count
FROM customers c
LEFT JOIN (
    SELECT customer_id, MAX(order_date) AS max_date
    FROM orders 
    WHERE order_status NOT IN ('CANCELLED', 'RETURNED')
    GROUP BY customer_id
) days_calc_raw ON days_calc_raw.customer_id = c.customer_id
LEFT JOIN (
    SELECT customer_id, DATEDIFF(CURDATE(), MAX(order_date)) AS days_since_order
    FROM orders 
    WHERE order_status NOT IN ('CANCELLED', 'RETURNED')
    GROUP BY customer_id
) days_calc ON days_calc.customer_id = c.customer_id
LEFT JOIN (
    SELECT o1.customer_id, o1.creator_id
    FROM orders o1
    INNER JOIN (
        SELECT customer_id, MAX(order_date) AS max_date
        FROM orders WHERE order_status NOT IN ('CANCELLED', 'RETURNED')
        GROUP BY customer_id
    ) o2 ON o1.customer_id = o2.customer_id AND o1.order_date = o2.max_date
) latest_order ON latest_order.customer_id = c.customer_id
LEFT JOIN basket_config bc_from ON bc_from.id = c.current_basket_key
WHERE c.assigned_to IS NOT NULL
  AND c.current_basket_key IN (39, 40, 46, 47, 48, 49, 50)
HAVING should_be_basket IS NOT NULL 
   AND should_be_basket != c.current_basket_key
ORDER BY current_basket, should_be_basket;


-- =============================================
-- DRY RUN 2: ดูรายละเอียดถัง 50 (โบราณ) ที่ผิด 1,780 คน
-- จะถูกย้ายไปถังไหนบ้าง
-- =============================================
SELECT 
    c.customer_id,
    CONCAT(c.first_name, ' ', c.last_name) AS customer_name,
    c.assigned_to,
    days_calc.days_since_order,
    latest_order.creator_id,
    CASE
        WHEN days_calc.days_since_order BETWEEN 0 AND 60 
             AND latest_order.creator_id = c.assigned_to THEN '→ 39 ส่วนตัว 1-2m'
        WHEN days_calc.days_since_order BETWEEN 0 AND 60 THEN '→ 47 รอคนมาจีบ'
        WHEN days_calc.days_since_order BETWEEN 61 AND 90 
             AND latest_order.creator_id = c.assigned_to THEN '→ 40 โอกาสสุดท้าย'
        WHEN days_calc.days_since_order BETWEEN 61 AND 90 THEN '→ 47 รอคนมาจีบ'
        WHEN days_calc.days_since_order BETWEEN 91 AND 180 THEN '→ 46 หาคนดูแลใหม่'
        WHEN days_calc.days_since_order BETWEEN 181 AND 365 THEN '→ 48 กลาง 6-12m'
        WHEN days_calc.days_since_order BETWEEN 366 AND 1095 THEN '→ 49 กลาง 1-3y'
        WHEN days_calc.days_since_order >= 1096 THEN '✅ ถูกแล้ว (50 โบราณ)'
        ELSE '❓ ไม่มี order'
    END AS target
FROM customers c
LEFT JOIN (
    SELECT customer_id, DATEDIFF(CURDATE(), MAX(order_date)) AS days_since_order
    FROM orders WHERE order_status NOT IN ('CANCELLED', 'RETURNED')
    GROUP BY customer_id
) days_calc ON days_calc.customer_id = c.customer_id
LEFT JOIN (
    SELECT o1.customer_id, o1.creator_id
    FROM orders o1
    INNER JOIN (
        SELECT customer_id, MAX(order_date) AS max_date
        FROM orders WHERE order_status NOT IN ('CANCELLED', 'RETURNED')
        GROUP BY customer_id
    ) o2 ON o1.customer_id = o2.customer_id AND o1.order_date = o2.max_date
) latest_order ON latest_order.customer_id = c.customer_id
WHERE c.current_basket_key = 50
  AND c.assigned_to IS NOT NULL
  AND days_calc.days_since_order < 1096
ORDER BY days_calc.days_since_order;


-- =============================================
-- =============================================
--           🔧 FIX QUERIES ด้านล่างนี้
--    ⚠️ ตรวจ DRY RUN ให้เรียบร้อยก่อนรัน!
-- =============================================
-- =============================================


-- =============================================
-- FIX 1: ถัง 50 (โบราณ) → ย้ายลูกค้าที่ order ไม่ถึง 1096 วัน
-- =============================================

-- 1A: order 0-60 วัน + creator = assigned_to → ถัง 39
UPDATE customers c
JOIN (
    SELECT customer_id, DATEDIFF(CURDATE(), MAX(order_date)) AS days_since_order
    FROM orders WHERE order_status NOT IN ('CANCELLED', 'RETURNED')
    GROUP BY customer_id
) d ON d.customer_id = c.customer_id
JOIN (
    SELECT o1.customer_id, o1.creator_id
    FROM orders o1
    INNER JOIN (
        SELECT customer_id, MAX(order_date) AS max_date
        FROM orders WHERE order_status NOT IN ('CANCELLED', 'RETURNED')
        GROUP BY customer_id
    ) o2 ON o1.customer_id = o2.customer_id AND o1.order_date = o2.max_date
) lo ON lo.customer_id = c.customer_id
SET c.current_basket_key = 39, c.basket_entered_date = NOW()
WHERE c.current_basket_key = 50
  AND c.assigned_to IS NOT NULL
  AND d.days_since_order BETWEEN 0 AND 60
  AND lo.creator_id = c.assigned_to;

-- 1B: order 0-60 วัน + creator ≠ assigned_to → ถัง 47
UPDATE customers c
JOIN (
    SELECT customer_id, DATEDIFF(CURDATE(), MAX(order_date)) AS days_since_order
    FROM orders WHERE order_status NOT IN ('CANCELLED', 'RETURNED')
    GROUP BY customer_id
) d ON d.customer_id = c.customer_id
JOIN (
    SELECT o1.customer_id, o1.creator_id
    FROM orders o1
    INNER JOIN (
        SELECT customer_id, MAX(order_date) AS max_date
        FROM orders WHERE order_status NOT IN ('CANCELLED', 'RETURNED')
        GROUP BY customer_id
    ) o2 ON o1.customer_id = o2.customer_id AND o1.order_date = o2.max_date
) lo ON lo.customer_id = c.customer_id
SET c.current_basket_key = 47, c.basket_entered_date = NOW()
WHERE c.current_basket_key = 50
  AND c.assigned_to IS NOT NULL
  AND d.days_since_order BETWEEN 0 AND 60
  AND lo.creator_id != c.assigned_to;

-- 1C: order 61-90 วัน + creator = assigned_to → ถัง 40
UPDATE customers c
JOIN (
    SELECT customer_id, DATEDIFF(CURDATE(), MAX(order_date)) AS days_since_order
    FROM orders WHERE order_status NOT IN ('CANCELLED', 'RETURNED')
    GROUP BY customer_id
) d ON d.customer_id = c.customer_id
JOIN (
    SELECT o1.customer_id, o1.creator_id
    FROM orders o1
    INNER JOIN (
        SELECT customer_id, MAX(order_date) AS max_date
        FROM orders WHERE order_status NOT IN ('CANCELLED', 'RETURNED')
        GROUP BY customer_id
    ) o2 ON o1.customer_id = o2.customer_id AND o1.order_date = o2.max_date
) lo ON lo.customer_id = c.customer_id
SET c.current_basket_key = 40, c.basket_entered_date = NOW()
WHERE c.current_basket_key = 50
  AND c.assigned_to IS NOT NULL
  AND d.days_since_order BETWEEN 61 AND 90
  AND lo.creator_id = c.assigned_to;

-- 1D: order 61-90 วัน + creator ≠ assigned_to → ถัง 47
UPDATE customers c
JOIN (
    SELECT customer_id, DATEDIFF(CURDATE(), MAX(order_date)) AS days_since_order
    FROM orders WHERE order_status NOT IN ('CANCELLED', 'RETURNED')
    GROUP BY customer_id
) d ON d.customer_id = c.customer_id
JOIN (
    SELECT o1.customer_id, o1.creator_id
    FROM orders o1
    INNER JOIN (
        SELECT customer_id, MAX(order_date) AS max_date
        FROM orders WHERE order_status NOT IN ('CANCELLED', 'RETURNED')
        GROUP BY customer_id
    ) o2 ON o1.customer_id = o2.customer_id AND o1.order_date = o2.max_date
) lo ON lo.customer_id = c.customer_id
SET c.current_basket_key = 47, c.basket_entered_date = NOW()
WHERE c.current_basket_key = 50
  AND c.assigned_to IS NOT NULL
  AND d.days_since_order BETWEEN 61 AND 90
  AND lo.creator_id != c.assigned_to;

-- 1E: order 91-180 วัน → ถัง 46
UPDATE customers c
JOIN (
    SELECT customer_id, DATEDIFF(CURDATE(), MAX(order_date)) AS days_since_order
    FROM orders WHERE order_status NOT IN ('CANCELLED', 'RETURNED')
    GROUP BY customer_id
) d ON d.customer_id = c.customer_id
SET c.current_basket_key = 46, c.basket_entered_date = NOW()
WHERE c.current_basket_key = 50
  AND c.assigned_to IS NOT NULL
  AND d.days_since_order BETWEEN 91 AND 180;

-- 1F: order 181-365 วัน → ถัง 48
UPDATE customers c
JOIN (
    SELECT customer_id, DATEDIFF(CURDATE(), MAX(order_date)) AS days_since_order
    FROM orders WHERE order_status NOT IN ('CANCELLED', 'RETURNED')
    GROUP BY customer_id
) d ON d.customer_id = c.customer_id
SET c.current_basket_key = 48, c.basket_entered_date = NOW()
WHERE c.current_basket_key = 50
  AND c.assigned_to IS NOT NULL
  AND d.days_since_order BETWEEN 181 AND 365;

-- 1G: order 366-1095 วัน → ถัง 49
UPDATE customers c
JOIN (
    SELECT customer_id, DATEDIFF(CURDATE(), MAX(order_date)) AS days_since_order
    FROM orders WHERE order_status NOT IN ('CANCELLED', 'RETURNED')
    GROUP BY customer_id
) d ON d.customer_id = c.customer_id
SET c.current_basket_key = 49, c.basket_entered_date = NOW()
WHERE c.current_basket_key = 50
  AND c.assigned_to IS NOT NULL
  AND d.days_since_order BETWEEN 366 AND 1095;


-- =============================================
-- FIX 2: ถัง 48 (กลาง 6-12m) → ลูกค้าที่ days ไม่อยู่ 181-365
-- =============================================

-- 2A: order 0-60 วัน + creator = assigned_to → ถัง 39
UPDATE customers c
JOIN (
    SELECT customer_id, DATEDIFF(CURDATE(), MAX(order_date)) AS days_since_order
    FROM orders WHERE order_status NOT IN ('CANCELLED', 'RETURNED')
    GROUP BY customer_id
) d ON d.customer_id = c.customer_id
JOIN (
    SELECT o1.customer_id, o1.creator_id
    FROM orders o1
    INNER JOIN (
        SELECT customer_id, MAX(order_date) AS max_date
        FROM orders WHERE order_status NOT IN ('CANCELLED', 'RETURNED')
        GROUP BY customer_id
    ) o2 ON o1.customer_id = o2.customer_id AND o1.order_date = o2.max_date
) lo ON lo.customer_id = c.customer_id
SET c.current_basket_key = 39, c.basket_entered_date = NOW()
WHERE c.current_basket_key = 48
  AND c.assigned_to IS NOT NULL
  AND d.days_since_order BETWEEN 0 AND 60
  AND lo.creator_id = c.assigned_to;

-- 2B: order 0-60 วัน + creator ≠ assigned_to → ถัง 47
UPDATE customers c
JOIN (
    SELECT customer_id, DATEDIFF(CURDATE(), MAX(order_date)) AS days_since_order
    FROM orders WHERE order_status NOT IN ('CANCELLED', 'RETURNED')
    GROUP BY customer_id
) d ON d.customer_id = c.customer_id
JOIN (
    SELECT o1.customer_id, o1.creator_id
    FROM orders o1
    INNER JOIN (
        SELECT customer_id, MAX(order_date) AS max_date
        FROM orders WHERE order_status NOT IN ('CANCELLED', 'RETURNED')
        GROUP BY customer_id
    ) o2 ON o1.customer_id = o2.customer_id AND o1.order_date = o2.max_date
) lo ON lo.customer_id = c.customer_id
SET c.current_basket_key = 47, c.basket_entered_date = NOW()
WHERE c.current_basket_key = 48
  AND c.assigned_to IS NOT NULL
  AND d.days_since_order BETWEEN 0 AND 60
  AND lo.creator_id != c.assigned_to;

-- 2C: order 61-90 วัน + creator = assigned_to → ถัง 40
UPDATE customers c
JOIN (
    SELECT customer_id, DATEDIFF(CURDATE(), MAX(order_date)) AS days_since_order
    FROM orders WHERE order_status NOT IN ('CANCELLED', 'RETURNED')
    GROUP BY customer_id
) d ON d.customer_id = c.customer_id
JOIN (
    SELECT o1.customer_id, o1.creator_id
    FROM orders o1
    INNER JOIN (
        SELECT customer_id, MAX(order_date) AS max_date
        FROM orders WHERE order_status NOT IN ('CANCELLED', 'RETURNED')
        GROUP BY customer_id
    ) o2 ON o1.customer_id = o2.customer_id AND o1.order_date = o2.max_date
) lo ON lo.customer_id = c.customer_id
SET c.current_basket_key = 40, c.basket_entered_date = NOW()
WHERE c.current_basket_key = 48
  AND c.assigned_to IS NOT NULL
  AND d.days_since_order BETWEEN 61 AND 90
  AND lo.creator_id = c.assigned_to;

-- 2D: order 61-90 วัน + creator ≠ assigned_to → ถัง 47
UPDATE customers c
JOIN (
    SELECT customer_id, DATEDIFF(CURDATE(), MAX(order_date)) AS days_since_order
    FROM orders WHERE order_status NOT IN ('CANCELLED', 'RETURNED')
    GROUP BY customer_id
) d ON d.customer_id = c.customer_id
JOIN (
    SELECT o1.customer_id, o1.creator_id
    FROM orders o1
    INNER JOIN (
        SELECT customer_id, MAX(order_date) AS max_date
        FROM orders WHERE order_status NOT IN ('CANCELLED', 'RETURNED')
        GROUP BY customer_id
    ) o2 ON o1.customer_id = o2.customer_id AND o1.order_date = o2.max_date
) lo ON lo.customer_id = c.customer_id
SET c.current_basket_key = 47, c.basket_entered_date = NOW()
WHERE c.current_basket_key = 48
  AND c.assigned_to IS NOT NULL
  AND d.days_since_order BETWEEN 61 AND 90
  AND lo.creator_id != c.assigned_to;

-- 2E: order 91-180 วัน → ถัง 46
UPDATE customers c
JOIN (
    SELECT customer_id, DATEDIFF(CURDATE(), MAX(order_date)) AS days_since_order
    FROM orders WHERE order_status NOT IN ('CANCELLED', 'RETURNED')
    GROUP BY customer_id
) d ON d.customer_id = c.customer_id
SET c.current_basket_key = 46, c.basket_entered_date = NOW()
WHERE c.current_basket_key = 48
  AND c.assigned_to IS NOT NULL
  AND d.days_since_order BETWEEN 91 AND 180;

-- 2F: order 366-1095 วัน → ถัง 49
UPDATE customers c
JOIN (
    SELECT customer_id, DATEDIFF(CURDATE(), MAX(order_date)) AS days_since_order
    FROM orders WHERE order_status NOT IN ('CANCELLED', 'RETURNED')
    GROUP BY customer_id
) d ON d.customer_id = c.customer_id
SET c.current_basket_key = 49, c.basket_entered_date = NOW()
WHERE c.current_basket_key = 48
  AND c.assigned_to IS NOT NULL
  AND d.days_since_order BETWEEN 366 AND 1095;

-- 2G: order >= 1096 วัน → ถัง 50
UPDATE customers c
JOIN (
    SELECT customer_id, DATEDIFF(CURDATE(), MAX(order_date)) AS days_since_order
    FROM orders WHERE order_status NOT IN ('CANCELLED', 'RETURNED')
    GROUP BY customer_id
) d ON d.customer_id = c.customer_id
SET c.current_basket_key = 50, c.basket_entered_date = NOW()
WHERE c.current_basket_key = 48
  AND c.assigned_to IS NOT NULL
  AND d.days_since_order >= 1096;


-- =============================================
-- FIX 3: ถัง 46 (หาคนดูแลใหม่) → ลูกค้าที่ days ไม่อยู่ 91-180
-- =============================================

-- 3A: order 0-60 วัน + creator = assigned_to → ถัง 39
UPDATE customers c
JOIN (
    SELECT customer_id, DATEDIFF(CURDATE(), MAX(order_date)) AS days_since_order
    FROM orders WHERE order_status NOT IN ('CANCELLED', 'RETURNED')
    GROUP BY customer_id
) d ON d.customer_id = c.customer_id
JOIN (
    SELECT o1.customer_id, o1.creator_id
    FROM orders o1
    INNER JOIN (
        SELECT customer_id, MAX(order_date) AS max_date
        FROM orders WHERE order_status NOT IN ('CANCELLED', 'RETURNED')
        GROUP BY customer_id
    ) o2 ON o1.customer_id = o2.customer_id AND o1.order_date = o2.max_date
) lo ON lo.customer_id = c.customer_id
SET c.current_basket_key = 39, c.basket_entered_date = NOW()
WHERE c.current_basket_key = 46
  AND c.assigned_to IS NOT NULL
  AND d.days_since_order BETWEEN 0 AND 60
  AND lo.creator_id = c.assigned_to;

-- 3B: order 0-60 วัน + creator ≠ assigned_to → ถัง 47
UPDATE customers c
JOIN (
    SELECT customer_id, DATEDIFF(CURDATE(), MAX(order_date)) AS days_since_order
    FROM orders WHERE order_status NOT IN ('CANCELLED', 'RETURNED')
    GROUP BY customer_id
) d ON d.customer_id = c.customer_id
JOIN (
    SELECT o1.customer_id, o1.creator_id
    FROM orders o1
    INNER JOIN (
        SELECT customer_id, MAX(order_date) AS max_date
        FROM orders WHERE order_status NOT IN ('CANCELLED', 'RETURNED')
        GROUP BY customer_id
    ) o2 ON o1.customer_id = o2.customer_id AND o1.order_date = o2.max_date
) lo ON lo.customer_id = c.customer_id
SET c.current_basket_key = 47, c.basket_entered_date = NOW()
WHERE c.current_basket_key = 46
  AND c.assigned_to IS NOT NULL
  AND d.days_since_order BETWEEN 0 AND 60
  AND lo.creator_id != c.assigned_to;

-- 3C: order 61-90 วัน + creator = assigned_to → ถัง 40
UPDATE customers c
JOIN (
    SELECT customer_id, DATEDIFF(CURDATE(), MAX(order_date)) AS days_since_order
    FROM orders WHERE order_status NOT IN ('CANCELLED', 'RETURNED')
    GROUP BY customer_id
) d ON d.customer_id = c.customer_id
JOIN (
    SELECT o1.customer_id, o1.creator_id
    FROM orders o1
    INNER JOIN (
        SELECT customer_id, MAX(order_date) AS max_date
        FROM orders WHERE order_status NOT IN ('CANCELLED', 'RETURNED')
        GROUP BY customer_id
    ) o2 ON o1.customer_id = o2.customer_id AND o1.order_date = o2.max_date
) lo ON lo.customer_id = c.customer_id
SET c.current_basket_key = 40, c.basket_entered_date = NOW()
WHERE c.current_basket_key = 46
  AND c.assigned_to IS NOT NULL
  AND d.days_since_order BETWEEN 61 AND 90
  AND lo.creator_id = c.assigned_to;

-- 3D: order 61-90 วัน + creator ≠ assigned_to → ถัง 47
UPDATE customers c
JOIN (
    SELECT customer_id, DATEDIFF(CURDATE(), MAX(order_date)) AS days_since_order
    FROM orders WHERE order_status NOT IN ('CANCELLED', 'RETURNED')
    GROUP BY customer_id
) d ON d.customer_id = c.customer_id
JOIN (
    SELECT o1.customer_id, o1.creator_id
    FROM orders o1
    INNER JOIN (
        SELECT customer_id, MAX(order_date) AS max_date
        FROM orders WHERE order_status NOT IN ('CANCELLED', 'RETURNED')
        GROUP BY customer_id
    ) o2 ON o1.customer_id = o2.customer_id AND o1.order_date = o2.max_date
) lo ON lo.customer_id = c.customer_id
SET c.current_basket_key = 47, c.basket_entered_date = NOW()
WHERE c.current_basket_key = 46
  AND c.assigned_to IS NOT NULL
  AND d.days_since_order BETWEEN 61 AND 90
  AND lo.creator_id != c.assigned_to;

-- 3E: order 181-365 วัน → ถัง 48
UPDATE customers c
JOIN (
    SELECT customer_id, DATEDIFF(CURDATE(), MAX(order_date)) AS days_since_order
    FROM orders WHERE order_status NOT IN ('CANCELLED', 'RETURNED')
    GROUP BY customer_id
) d ON d.customer_id = c.customer_id
SET c.current_basket_key = 48, c.basket_entered_date = NOW()
WHERE c.current_basket_key = 46
  AND c.assigned_to IS NOT NULL
  AND d.days_since_order BETWEEN 181 AND 365;

-- 3F: order 366-1095 วัน → ถัง 49
UPDATE customers c
JOIN (
    SELECT customer_id, DATEDIFF(CURDATE(), MAX(order_date)) AS days_since_order
    FROM orders WHERE order_status NOT IN ('CANCELLED', 'RETURNED')
    GROUP BY customer_id
) d ON d.customer_id = c.customer_id
SET c.current_basket_key = 49, c.basket_entered_date = NOW()
WHERE c.current_basket_key = 46
  AND c.assigned_to IS NOT NULL
  AND d.days_since_order BETWEEN 366 AND 1095;

-- 3G: order >= 1096 วัน → ถัง 50
UPDATE customers c
JOIN (
    SELECT customer_id, DATEDIFF(CURDATE(), MAX(order_date)) AS days_since_order
    FROM orders WHERE order_status NOT IN ('CANCELLED', 'RETURNED')
    GROUP BY customer_id
) d ON d.customer_id = c.customer_id
SET c.current_basket_key = 50, c.basket_entered_date = NOW()
WHERE c.current_basket_key = 46
  AND c.assigned_to IS NOT NULL
  AND d.days_since_order >= 1096;


-- =============================================
-- FIX 4: ถัง 39 (ส่วนตัว 1-2m) → ลูกค้าที่ order > 60 วัน
-- =============================================

-- 4A: order 61-90 วัน → ถัง 40
UPDATE customers c
JOIN (
    SELECT customer_id, DATEDIFF(CURDATE(), MAX(order_date)) AS days_since_order
    FROM orders WHERE order_status NOT IN ('CANCELLED', 'RETURNED')
    GROUP BY customer_id
) d ON d.customer_id = c.customer_id
SET c.current_basket_key = 40, c.basket_entered_date = NOW()
WHERE c.current_basket_key = 39
  AND c.assigned_to IS NOT NULL
  AND d.days_since_order BETWEEN 61 AND 90;

-- 4B: order 91-180 วัน → ถัง 46
UPDATE customers c
JOIN (
    SELECT customer_id, DATEDIFF(CURDATE(), MAX(order_date)) AS days_since_order
    FROM orders WHERE order_status NOT IN ('CANCELLED', 'RETURNED')
    GROUP BY customer_id
) d ON d.customer_id = c.customer_id
SET c.current_basket_key = 46, c.basket_entered_date = NOW()
WHERE c.current_basket_key = 39
  AND c.assigned_to IS NOT NULL
  AND d.days_since_order BETWEEN 91 AND 180;

-- 4C: order 181-365 วัน → ถัง 48
UPDATE customers c
JOIN (
    SELECT customer_id, DATEDIFF(CURDATE(), MAX(order_date)) AS days_since_order
    FROM orders WHERE order_status NOT IN ('CANCELLED', 'RETURNED')
    GROUP BY customer_id
) d ON d.customer_id = c.customer_id
SET c.current_basket_key = 48, c.basket_entered_date = NOW()
WHERE c.current_basket_key = 39
  AND c.assigned_to IS NOT NULL
  AND d.days_since_order BETWEEN 181 AND 365;

-- 4D: order 366-1095 วัน → ถัง 49
UPDATE customers c
JOIN (
    SELECT customer_id, DATEDIFF(CURDATE(), MAX(order_date)) AS days_since_order
    FROM orders WHERE order_status NOT IN ('CANCELLED', 'RETURNED')
    GROUP BY customer_id
) d ON d.customer_id = c.customer_id
SET c.current_basket_key = 49, c.basket_entered_date = NOW()
WHERE c.current_basket_key = 39
  AND c.assigned_to IS NOT NULL
  AND d.days_since_order BETWEEN 366 AND 1095;

-- 4E: order >= 1096 วัน → ถัง 50
UPDATE customers c
JOIN (
    SELECT customer_id, DATEDIFF(CURDATE(), MAX(order_date)) AS days_since_order
    FROM orders WHERE order_status NOT IN ('CANCELLED', 'RETURNED')
    GROUP BY customer_id
) d ON d.customer_id = c.customer_id
SET c.current_basket_key = 50, c.basket_entered_date = NOW()
WHERE c.current_basket_key = 39
  AND c.assigned_to IS NOT NULL
  AND d.days_since_order >= 1096;


-- =============================================
-- FIX 5: ถัง 49 (กลาง 1-3y) → ลูกค้าที่ days ไม่อยู่ 366-1095
-- =============================================

-- 5A: order 0-180 วัน → ถัง 47
UPDATE customers c
JOIN (
    SELECT customer_id, DATEDIFF(CURDATE(), MAX(order_date)) AS days_since_order
    FROM orders WHERE order_status NOT IN ('CANCELLED', 'RETURNED')
    GROUP BY customer_id
) d ON d.customer_id = c.customer_id
SET c.current_basket_key = 47, c.basket_entered_date = NOW()
WHERE c.current_basket_key = 49
  AND c.assigned_to IS NOT NULL
  AND d.days_since_order BETWEEN 0 AND 180;

-- 5B: order 181-365 วัน → ถัง 48
UPDATE customers c
JOIN (
    SELECT customer_id, DATEDIFF(CURDATE(), MAX(order_date)) AS days_since_order
    FROM orders WHERE order_status NOT IN ('CANCELLED', 'RETURNED')
    GROUP BY customer_id
) d ON d.customer_id = c.customer_id
SET c.current_basket_key = 48, c.basket_entered_date = NOW()
WHERE c.current_basket_key = 49
  AND c.assigned_to IS NOT NULL
  AND d.days_since_order BETWEEN 181 AND 365;

-- 5C: order >= 1096 วัน → ถัง 50
UPDATE customers c
JOIN (
    SELECT customer_id, DATEDIFF(CURDATE(), MAX(order_date)) AS days_since_order
    FROM orders WHERE order_status NOT IN ('CANCELLED', 'RETURNED')
    GROUP BY customer_id
) d ON d.customer_id = c.customer_id
SET c.current_basket_key = 50, c.basket_entered_date = NOW()
WHERE c.current_basket_key = 49
  AND c.assigned_to IS NOT NULL
  AND d.days_since_order >= 1096;


-- =============================================
-- FIX 6: ถัง 47 (รอจีบ) → ลูกค้าที่ order > 180 วัน
-- =============================================

-- 6A: order 181-365 วัน → ถัง 48
UPDATE customers c
JOIN (
    SELECT customer_id, DATEDIFF(CURDATE(), MAX(order_date)) AS days_since_order
    FROM orders WHERE order_status NOT IN ('CANCELLED', 'RETURNED')
    GROUP BY customer_id
) d ON d.customer_id = c.customer_id
SET c.current_basket_key = 48, c.basket_entered_date = NOW()
WHERE c.current_basket_key = 47
  AND c.assigned_to IS NOT NULL
  AND d.days_since_order BETWEEN 181 AND 365;

-- 6B: order 366-1095 วัน → ถัง 49
UPDATE customers c
JOIN (
    SELECT customer_id, DATEDIFF(CURDATE(), MAX(order_date)) AS days_since_order
    FROM orders WHERE order_status NOT IN ('CANCELLED', 'RETURNED')
    GROUP BY customer_id
) d ON d.customer_id = c.customer_id
SET c.current_basket_key = 49, c.basket_entered_date = NOW()
WHERE c.current_basket_key = 47
  AND c.assigned_to IS NOT NULL
  AND d.days_since_order BETWEEN 366 AND 1095;

-- 6C: order >= 1096 วัน → ถัง 50
UPDATE customers c
JOIN (
    SELECT customer_id, DATEDIFF(CURDATE(), MAX(order_date)) AS days_since_order
    FROM orders WHERE order_status NOT IN ('CANCELLED', 'RETURNED')
    GROUP BY customer_id
) d ON d.customer_id = c.customer_id
SET c.current_basket_key = 50, c.basket_entered_date = NOW()
WHERE c.current_basket_key = 47
  AND c.assigned_to IS NOT NULL
  AND d.days_since_order >= 1096;


-- =============================================
-- VERIFY: รัน audit query อีกครั้งหลัง fix เพื่อเทียบ
-- =============================================
SELECT 
    c.current_basket_key AS basket_id,
    bc.basket_name,
    COUNT(*) AS total_in_basket,
    SUM(CASE 
        WHEN c.current_basket_key = 39 AND DATEDIFF(CURDATE(), latest_o.max_date) > 60 THEN 1
        WHEN c.current_basket_key = 40 AND (DATEDIFF(CURDATE(), latest_o.max_date) < 61 OR DATEDIFF(CURDATE(), latest_o.max_date) > 90) THEN 1
        WHEN c.current_basket_key = 46 AND (DATEDIFF(CURDATE(), latest_o.max_date) < 91 OR DATEDIFF(CURDATE(), latest_o.max_date) > 180) THEN 1
        WHEN c.current_basket_key = 47 AND DATEDIFF(CURDATE(), latest_o.max_date) > 180 THEN 1
        WHEN c.current_basket_key = 48 AND (DATEDIFF(CURDATE(), latest_o.max_date) < 181 OR DATEDIFF(CURDATE(), latest_o.max_date) > 365) THEN 1
        WHEN c.current_basket_key = 49 AND (DATEDIFF(CURDATE(), latest_o.max_date) < 366 OR DATEDIFF(CURDATE(), latest_o.max_date) > 1095) THEN 1
        WHEN c.current_basket_key = 50 AND DATEDIFF(CURDATE(), latest_o.max_date) < 1096 THEN 1
        ELSE 0
    END) AS wrong_basket_count
FROM customers c
LEFT JOIN (
    SELECT customer_id, MAX(order_date) AS max_date
    FROM orders WHERE order_status NOT IN ('CANCELLED', 'RETURNED')
    GROUP BY customer_id
) latest_o ON latest_o.customer_id = c.customer_id
LEFT JOIN basket_config bc ON bc.id = c.current_basket_key
WHERE c.assigned_to IS NOT NULL
  AND c.current_basket_key IN (38, 39, 40, 46, 47, 48, 49, 50, 51)
GROUP BY c.current_basket_key, bc.basket_name
ORDER BY c.current_basket_key;
