-- =====================================================
-- Initial Basket Assignment - EXECUTE UPDATE
-- ⚠️ รันเฉพาะเมื่อพร้อมแล้ว!
-- =====================================================

-- =====================================================
-- STEP 1: ASSIGNED CUSTOMERS
-- =====================================================

-- [51] Upsell (Dashboard)
UPDATE customers c
SET c.current_basket_key = '51', c.basket_entered_date = NOW()
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
UPDATE customers c
SET c.current_basket_key = '38', c.basket_entered_date = NOW()
WHERE c.assigned_to IS NOT NULL
AND c.current_basket_key NOT IN ('51')
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
UPDATE customers c
SET c.current_basket_key = '39', c.basket_entered_date = NOW()
WHERE c.assigned_to IS NOT NULL
AND (c.current_basket_key IS NULL OR c.current_basket_key NOT IN ('51', '38'))
AND EXISTS (
    SELECT 1 FROM orders o
    WHERE o.customer_id = c.customer_id
    AND o.creator_id = c.assigned_to
    AND o.order_status != 'Cancelled'
    AND DATEDIFF(CURDATE(), o.order_date) BETWEEN 1 AND 60
    AND o.order_date = (SELECT MAX(o2.order_date) FROM orders o2 WHERE o2.customer_id = c.customer_id AND o2.order_status != 'Cancelled')
);

-- [40] โอกาสสุดท้าย
UPDATE customers c
SET c.current_basket_key = '40', c.basket_entered_date = NOW()
WHERE c.assigned_to IS NOT NULL
AND (c.current_basket_key IS NULL OR c.current_basket_key NOT IN ('51', '38', '39'))
AND EXISTS (
    SELECT 1 FROM orders o
    WHERE o.customer_id = c.customer_id
    AND o.creator_id = c.assigned_to
    AND o.order_status != 'Cancelled'
    AND DATEDIFF(CURDATE(), o.order_date) BETWEEN 61 AND 90
    AND o.order_date = (SELECT MAX(o2.order_date) FROM orders o2 WHERE o2.customer_id = c.customer_id AND o2.order_status != 'Cancelled')
);

-- [46] หาคนดูแลใหม่ (Dashboard)
UPDATE customers c
SET c.current_basket_key = '46', c.basket_entered_date = NOW()
WHERE c.assigned_to IS NOT NULL
AND (c.current_basket_key IS NULL OR c.current_basket_key NOT IN ('51', '38', '39', '40'))
AND EXISTS (
    SELECT 1 FROM orders o
    JOIN users u ON o.creator_id = u.id
    WHERE o.customer_id = c.customer_id
    AND u.role_id IN (6, 7)
    AND o.creator_id != c.assigned_to
    AND o.order_status != 'Cancelled'
    AND DATEDIFF(CURDATE(), o.order_date) BETWEEN 91 AND 180
    AND o.order_date = (SELECT MAX(o2.order_date) FROM orders o2 WHERE o2.customer_id = c.customer_id AND o2.order_status != 'Cancelled')
);

-- [47] รอคนมาจีบ (Dashboard)
UPDATE customers c
SET c.current_basket_key = '47', c.basket_entered_date = NOW()
WHERE c.assigned_to IS NOT NULL
AND (c.current_basket_key IS NULL OR c.current_basket_key NOT IN ('51', '38', '39', '40', '46'))
AND EXISTS (
    SELECT 1 FROM orders o
    JOIN users u ON o.creator_id = u.id
    WHERE o.customer_id = c.customer_id
    AND u.role_id = 3
    AND o.order_status != 'Cancelled'
    AND DATEDIFF(CURDATE(), o.order_date) BETWEEN 1 AND 180
    AND o.order_date = (SELECT MAX(o2.order_date) FROM orders o2 WHERE o2.customer_id = c.customer_id AND o2.order_status != 'Cancelled')
);

-- [48] ถังกลาง 6-12 เดือน (Dashboard)
UPDATE customers c
SET c.current_basket_key = '48', c.basket_entered_date = NOW()
WHERE c.assigned_to IS NOT NULL
AND (c.current_basket_key IS NULL OR c.current_basket_key NOT IN ('51', '38', '39', '40', '46', '47'))
AND EXISTS (
    SELECT 1 FROM orders o
    WHERE o.customer_id = c.customer_id
    AND o.creator_id = c.assigned_to
    AND o.order_status != 'Cancelled'
    AND DATEDIFF(CURDATE(), o.order_date) BETWEEN 181 AND 365
    AND o.order_date = (SELECT MAX(o2.order_date) FROM orders o2 WHERE o2.customer_id = c.customer_id AND o2.order_status != 'Cancelled')
);

-- [49] ถังกลาง 1-3 ปี (Dashboard)
UPDATE customers c
SET c.current_basket_key = '49', c.basket_entered_date = NOW()
WHERE c.assigned_to IS NOT NULL
AND (c.current_basket_key IS NULL OR c.current_basket_key NOT IN ('51', '38', '39', '40', '46', '47', '48'))
AND EXISTS (
    SELECT 1 FROM orders o
    WHERE o.customer_id = c.customer_id
    AND o.creator_id = c.assigned_to
    AND o.order_status != 'Cancelled'
    AND DATEDIFF(CURDATE(), o.order_date) BETWEEN 366 AND 1095
    AND o.order_date = (SELECT MAX(o2.order_date) FROM orders o2 WHERE o2.customer_id = c.customer_id AND o2.order_status != 'Cancelled')
);

-- [50] ถังโบราณ (Dashboard)
UPDATE customers c
SET c.current_basket_key = '50', c.basket_entered_date = NOW()
WHERE c.assigned_to IS NOT NULL
AND (c.current_basket_key IS NULL OR c.current_basket_key NOT IN ('51', '38', '39', '40', '46', '47', '48', '49'))
AND EXISTS (
    SELECT 1 FROM orders o
    WHERE o.customer_id = c.customer_id
    AND o.creator_id = c.assigned_to
    AND o.order_status != 'Cancelled'
    AND DATEDIFF(CURDATE(), o.order_date) > 1095
    AND o.order_date = (SELECT MAX(o2.order_date) FROM orders o2 WHERE o2.customer_id = c.customer_id AND o2.order_status != 'Cancelled')
);

-- =====================================================
-- STEP 2: UNASSIGNED CUSTOMERS
-- =====================================================

-- [42] รอคนมาจีบ (Distribution)
UPDATE customers c
SET c.current_basket_key = '42', c.basket_entered_date = NOW()
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

-- [41] หาคนดูแลใหม่ (Distribution)
UPDATE customers c
SET c.current_basket_key = '41', c.basket_entered_date = NOW()
WHERE c.assigned_to IS NULL
AND (c.current_basket_key IS NULL OR c.current_basket_key != '42')
AND NOT EXISTS (SELECT 1 FROM orders op WHERE op.customer_id = c.customer_id AND op.order_status = 'Pending')
AND EXISTS (
    SELECT 1 FROM orders o
    JOIN users u ON o.creator_id = u.id
    WHERE o.customer_id = c.customer_id
    AND u.role_id IN (6, 7)
    AND o.order_status != 'Cancelled'
    AND DATEDIFF(CURDATE(), o.order_date) BETWEEN 1 AND 180
    AND o.order_date = (SELECT MAX(o2.order_date) FROM orders o2 WHERE o2.customer_id = c.customer_id AND o2.order_status != 'Cancelled')
);

-- [43] ถังกลาง 6-12 เดือน (Distribution)
UPDATE customers c
SET c.current_basket_key = '43', c.basket_entered_date = NOW()
WHERE c.assigned_to IS NULL
AND (c.current_basket_key IS NULL OR c.current_basket_key NOT IN ('42', '41'))
AND NOT EXISTS (SELECT 1 FROM orders op WHERE op.customer_id = c.customer_id AND op.order_status = 'Pending')
AND EXISTS (
    SELECT 1 FROM orders o
    WHERE o.customer_id = c.customer_id
    AND o.order_status != 'Cancelled'
    AND DATEDIFF(CURDATE(), o.order_date) BETWEEN 181 AND 365
    AND o.order_date = (SELECT MAX(o2.order_date) FROM orders o2 WHERE o2.customer_id = c.customer_id AND o2.order_status != 'Cancelled')
);

-- [44] ถังกลาง 1-3 ปี (Distribution)
UPDATE customers c
SET c.current_basket_key = '44', c.basket_entered_date = NOW()
WHERE c.assigned_to IS NULL
AND (c.current_basket_key IS NULL OR c.current_basket_key NOT IN ('42', '41', '43'))
AND NOT EXISTS (SELECT 1 FROM orders op WHERE op.customer_id = c.customer_id AND op.order_status = 'Pending')
AND EXISTS (
    SELECT 1 FROM orders o
    WHERE o.customer_id = c.customer_id
    AND o.order_status != 'Cancelled'
    AND DATEDIFF(CURDATE(), o.order_date) BETWEEN 366 AND 1095
    AND o.order_date = (SELECT MAX(o2.order_date) FROM orders o2 WHERE o2.customer_id = c.customer_id AND o2.order_status != 'Cancelled')
);

-- [45] ถังโบราณ (Distribution)
UPDATE customers c
SET c.current_basket_key = '45', c.basket_entered_date = NOW()
WHERE c.assigned_to IS NULL
AND (c.current_basket_key IS NULL OR c.current_basket_key NOT IN ('42', '41', '43', '44'))
AND NOT EXISTS (SELECT 1 FROM orders op WHERE op.customer_id = c.customer_id AND op.order_status = 'Pending')
AND EXISTS (
    SELECT 1 FROM orders o
    WHERE o.customer_id = c.customer_id
    AND o.order_status != 'Cancelled'
    AND DATEDIFF(CURDATE(), o.order_date) > 1095
    AND o.order_date = (SELECT MAX(o2.order_date) FROM orders o2 WHERE o2.customer_id = c.customer_id AND o2.order_status != 'Cancelled')
);

-- =====================================================
-- STEP 3: FALLBACK (date_registered)
-- =====================================================

-- Assigned Fallback 1-60d → [39]
UPDATE customers c
SET c.current_basket_key = '39', c.basket_entered_date = NOW()
WHERE c.assigned_to IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.customer_id AND o.order_status != 'Cancelled')
AND c.date_registered IS NOT NULL
AND DATEDIFF(CURDATE(), c.date_registered) BETWEEN 1 AND 60;

-- Assigned Fallback 61-90d → [40]
UPDATE customers c
SET c.current_basket_key = '40', c.basket_entered_date = NOW()
WHERE c.assigned_to IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.customer_id AND o.order_status != 'Cancelled')
AND c.date_registered IS NOT NULL
AND DATEDIFF(CURDATE(), c.date_registered) BETWEEN 61 AND 90;

-- Assigned Fallback 91-180d → [47]
UPDATE customers c
SET c.current_basket_key = '47', c.basket_entered_date = NOW()
WHERE c.assigned_to IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.customer_id AND o.order_status != 'Cancelled')
AND c.date_registered IS NOT NULL
AND DATEDIFF(CURDATE(), c.date_registered) BETWEEN 91 AND 180;

-- Assigned Fallback 181-365d → [48]
UPDATE customers c
SET c.current_basket_key = '48', c.basket_entered_date = NOW()
WHERE c.assigned_to IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.customer_id AND o.order_status != 'Cancelled')
AND c.date_registered IS NOT NULL
AND DATEDIFF(CURDATE(), c.date_registered) BETWEEN 181 AND 365;

-- Assigned Fallback 366-1095d → [49]
UPDATE customers c
SET c.current_basket_key = '49', c.basket_entered_date = NOW()
WHERE c.assigned_to IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.customer_id AND o.order_status != 'Cancelled')
AND c.date_registered IS NOT NULL
AND DATEDIFF(CURDATE(), c.date_registered) BETWEEN 366 AND 1095;

-- Assigned Fallback >1095d → [50]
UPDATE customers c
SET c.current_basket_key = '50', c.basket_entered_date = NOW()
WHERE c.assigned_to IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.customer_id AND o.order_status != 'Cancelled')
AND c.date_registered IS NOT NULL
AND DATEDIFF(CURDATE(), c.date_registered) > 1095;

-- Unassigned Fallback 1-180d → [42]
UPDATE customers c
SET c.current_basket_key = '42', c.basket_entered_date = NOW()
WHERE c.assigned_to IS NULL
AND NOT EXISTS (SELECT 1 FROM orders op WHERE op.customer_id = c.customer_id AND op.order_status = 'Pending')
AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.customer_id AND o.order_status != 'Cancelled')
AND c.date_registered IS NOT NULL
AND DATEDIFF(CURDATE(), c.date_registered) BETWEEN 1 AND 180;

-- Unassigned Fallback 181-365d → [43]
UPDATE customers c
SET c.current_basket_key = '43', c.basket_entered_date = NOW()
WHERE c.assigned_to IS NULL
AND NOT EXISTS (SELECT 1 FROM orders op WHERE op.customer_id = c.customer_id AND op.order_status = 'Pending')
AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.customer_id AND o.order_status != 'Cancelled')
AND c.date_registered IS NOT NULL
AND DATEDIFF(CURDATE(), c.date_registered) BETWEEN 181 AND 365;

-- Unassigned Fallback 366-1095d → [44]
UPDATE customers c
SET c.current_basket_key = '44', c.basket_entered_date = NOW()
WHERE c.assigned_to IS NULL
AND NOT EXISTS (SELECT 1 FROM orders op WHERE op.customer_id = c.customer_id AND op.order_status = 'Pending')
AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.customer_id AND o.order_status != 'Cancelled')
AND c.date_registered IS NOT NULL
AND DATEDIFF(CURDATE(), c.date_registered) BETWEEN 366 AND 1095;

-- Unassigned Fallback >1095d → [45]
UPDATE customers c
SET c.current_basket_key = '45', c.basket_entered_date = NOW()
WHERE c.assigned_to IS NULL
AND NOT EXISTS (SELECT 1 FROM orders op WHERE op.customer_id = c.customer_id AND op.order_status = 'Pending')
AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.customer_id AND o.order_status != 'Cancelled')
AND c.date_registered IS NOT NULL
AND DATEDIFF(CURDATE(), c.date_registered) > 1095;
