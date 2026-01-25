-- =====================================================
-- Initial Basket Assignment - PREVIEW COUNTS
-- รัน SELECT ก่อนเพื่อดูยอด แล้วค่อยรัน UPDATE
-- =====================================================

-- =====================================================
-- STEP 0: เช็ค Upsell (ห้ามแตะ!)
-- =====================================================
SELECT '⛔ Upsell (Pending order)' as basket, 
       COUNT(*) as customers 
FROM customers c
WHERE c.assigned_to IS NULL 
AND EXISTS (
    SELECT 1 FROM orders o 
    WHERE o.customer_id = c.customer_id 
    AND o.order_status = 'Pending'
);

-- =====================================================
-- STEP 1: ASSIGNED CUSTOMERS - PREVIEW
-- =====================================================

-- [51] Upsell (Dashboard)
SELECT '[51] Upsell (Dashboard)' as basket, COUNT(*) as customers 
FROM customers c
WHERE c.assigned_to IS NOT NULL
AND EXISTS (
    SELECT 1 FROM orders o
    JOIN users u ON o.creator_id = u.id
    WHERE o.customer_id = c.customer_id
    AND u.role_id = 3
    AND o.order_status = 'Pending'
    AND o.order_date = (SELECT MAX(o2.order_date) FROM orders o2 WHERE o2.customer_id = c.customer_id)
);

-- [38] ลูกค้าใหม่
SELECT '[38] ลูกค้าใหม่' as basket, COUNT(*) as customers 
FROM customers c
WHERE c.assigned_to IS NOT NULL
AND EXISTS (
    SELECT 1 FROM orders o
    JOIN users u ON o.creator_id = u.id
    WHERE o.customer_id = c.customer_id
    AND u.role_id = 3
    AND o.order_status != 'Cancelled'
    AND DATEDIFF(CURDATE(), o.order_date) BETWEEN 1 AND 60
    AND o.order_date = (SELECT MAX(o2.order_date) FROM orders o2 WHERE o2.customer_id = c.customer_id AND o2.order_status != 'Cancelled')
);

-- [39] ส่วนตัว 1-2 เดือน
SELECT '[39] ส่วนตัว 1-2 เดือน' as basket, COUNT(*) as customers 
FROM customers c
WHERE c.assigned_to IS NOT NULL
AND EXISTS (
    SELECT 1 FROM orders o
    WHERE o.customer_id = c.customer_id
    AND o.creator_id = c.assigned_to
    AND o.order_status != 'Cancelled'
    AND DATEDIFF(CURDATE(), o.order_date) BETWEEN 1 AND 60
    AND o.order_date = (SELECT MAX(o2.order_date) FROM orders o2 WHERE o2.customer_id = c.customer_id AND o2.order_status != 'Cancelled')
);

-- [40] โอกาสสุดท้าย
SELECT '[40] โอกาสสุดท้าย' as basket, COUNT(*) as customers 
FROM customers c
WHERE c.assigned_to IS NOT NULL
AND EXISTS (
    SELECT 1 FROM orders o
    WHERE o.customer_id = c.customer_id
    AND o.creator_id = c.assigned_to
    AND o.order_status != 'Cancelled'
    AND DATEDIFF(CURDATE(), o.order_date) BETWEEN 61 AND 90
    AND o.order_date = (SELECT MAX(o2.order_date) FROM orders o2 WHERE o2.customer_id = c.customer_id AND o2.order_status != 'Cancelled')
);

-- =====================================================
-- STEP 2: UNASSIGNED CUSTOMERS - PREVIEW
-- =====================================================

-- [42] รอคนมาจีบ (Distribution)
SELECT '[42] รอคนมาจีบ' as basket, COUNT(*) as customers 
FROM customers c
WHERE c.assigned_to IS NULL
AND NOT EXISTS (SELECT 1 FROM orders op WHERE op.customer_id = c.customer_id AND op.order_status = 'Pending')
AND EXISTS (
    SELECT 1 FROM orders o
    JOIN users u ON o.creator_id = u.id
    WHERE o.customer_id = c.customer_id
    AND u.role_id = 3
    AND o.order_status != 'Cancelled'
    AND DATEDIFF(CURDATE(), o.order_date) BETWEEN 1 AND 180
    AND o.order_date = (SELECT MAX(o2.order_date) FROM orders o2 WHERE o2.customer_id = c.customer_id AND o2.order_status != 'Cancelled')
);

-- [43] ถังกลาง 6-12 เดือน
SELECT '[43] ถังกลาง 6-12 เดือน' as basket, COUNT(*) as customers 
FROM customers c
WHERE c.assigned_to IS NULL
AND NOT EXISTS (SELECT 1 FROM orders op WHERE op.customer_id = c.customer_id AND op.order_status = 'Pending')
AND EXISTS (
    SELECT 1 FROM orders o
    WHERE o.customer_id = c.customer_id
    AND o.order_status != 'Cancelled'
    AND DATEDIFF(CURDATE(), o.order_date) BETWEEN 181 AND 365
    AND o.order_date = (SELECT MAX(o2.order_date) FROM orders o2 WHERE o2.customer_id = c.customer_id AND o2.order_status != 'Cancelled')
);

-- [44] ถังกลาง 1-3 ปี
SELECT '[44] ถังกลาง 1-3 ปี' as basket, COUNT(*) as customers 
FROM customers c
WHERE c.assigned_to IS NULL
AND NOT EXISTS (SELECT 1 FROM orders op WHERE op.customer_id = c.customer_id AND op.order_status = 'Pending')
AND EXISTS (
    SELECT 1 FROM orders o
    WHERE o.customer_id = c.customer_id
    AND o.order_status != 'Cancelled'
    AND DATEDIFF(CURDATE(), o.order_date) BETWEEN 366 AND 1095
    AND o.order_date = (SELECT MAX(o2.order_date) FROM orders o2 WHERE o2.customer_id = c.customer_id AND o2.order_status != 'Cancelled')
);

-- [45] ถังโบราณ
SELECT '[45] ถังโบราณ' as basket, COUNT(*) as customers 
FROM customers c
WHERE c.assigned_to IS NULL
AND NOT EXISTS (SELECT 1 FROM orders op WHERE op.customer_id = c.customer_id AND op.order_status = 'Pending')
AND EXISTS (
    SELECT 1 FROM orders o
    WHERE o.customer_id = c.customer_id
    AND o.order_status != 'Cancelled'
    AND DATEDIFF(CURDATE(), o.order_date) > 1095
    AND o.order_date = (SELECT MAX(o2.order_date) FROM orders o2 WHERE o2.customer_id = c.customer_id AND o2.order_status != 'Cancelled')
);

-- =====================================================
-- STEP 3: FALLBACK (date_registered) - PREVIEW
-- =====================================================

-- Assigned Fallback
SELECT '[39] Fallback ส่วนตัว 1-60d' as basket, COUNT(*) as customers 
FROM customers c
WHERE c.assigned_to IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.customer_id AND o.order_status != 'Cancelled')
AND c.date_registered IS NOT NULL
AND DATEDIFF(CURDATE(), c.date_registered) BETWEEN 1 AND 60;

SELECT '[42] Fallback รอคนมาจีบ 1-180d' as basket, COUNT(*) as customers 
FROM customers c
WHERE c.assigned_to IS NULL
AND NOT EXISTS (SELECT 1 FROM orders op WHERE op.customer_id = c.customer_id AND op.order_status = 'Pending')
AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.customer_id AND o.order_status != 'Cancelled')
AND c.date_registered IS NOT NULL
AND DATEDIFF(CURDATE(), c.date_registered) BETWEEN 1 AND 180;
