-- ============================================
-- SQL Script: Update Customer Statistics (Fixed)
-- Description: อัปเดตสถิติลูกค้าจากข้อมูลที่นำเข้า
-- ============================================

-- 1. อัปเดต total_calls จาก call_history
UPDATE customers c
SET total_calls = (
    SELECT COUNT(*) 
    FROM call_history ch 
    WHERE ch.customer_id = c.customer_id
)
WHERE total_calls IS NULL OR total_calls = 0;

-- 2. อัปเดต order_count และ total_purchases จาก orders
-- แก้ไข: ใช้ total_amount แทน net_amount
UPDATE customers c
SET 
    order_count = (
        SELECT COUNT(*) 
        FROM orders o 
        WHERE o.customer_id = c.customer_id
    ),
    total_purchases = (
        SELECT COALESCE(SUM(o.total_amount), 0) 
        FROM orders o 
        WHERE o.customer_id = c.customer_id
    )
WHERE order_count IS NULL OR order_count = 0;

-- 3. อัปเดต first_order_date และ last_order_date
UPDATE customers c
SET 
    first_order_date = (
        SELECT MIN(o.order_date) 
        FROM orders o 
        WHERE o.customer_id = c.customer_id
    ),
    last_order_date = (
        SELECT MAX(o.order_date) 
        FROM orders o 
        WHERE o.customer_id = c.customer_id
    )
WHERE first_order_date IS NULL OR last_order_date IS NULL;

-- 4. อัปเดต has_sold_before (มีออเดอร์หรือไม่)
UPDATE customers c
SET has_sold_before = (
    SELECT CASE WHEN COUNT(*) > 0 THEN 1 ELSE 0 END
    FROM orders o 
    WHERE o.customer_id = c.customer_id
);

-- 5. อัปเดต is_new_customer และ is_repeat_customer
UPDATE customers c
SET 
    is_new_customer = CASE WHEN order_count = 0 THEN 1 ELSE 0 END,
    is_repeat_customer = CASE WHEN order_count > 1 THEN 1 ELSE 0 END
WHERE order_count IS NOT NULL;

-- 6. อัปเดต follow_up_count จาก appointments
UPDATE customers c
SET follow_up_count = (
    SELECT COUNT(*) 
    FROM appointments a 
    WHERE a.customer_id = c.customer_id
)
WHERE follow_up_count IS NULL OR follow_up_count = 0;

-- 7. อัปเดต last_follow_up_date จาก appointments
UPDATE customers c
SET last_follow_up_date = (
    SELECT MAX(a.date) 
    FROM appointments a 
    WHERE a.customer_id = c.customer_id
)
WHERE last_follow_up_date IS NULL;

-- 8. อัปเดต last_sale_date จาก orders ที่มี payment_status = 'paid'
-- หมายเหตุ: payment_status ในตารางเป็น varchar อาจไม่ใช่ enum 'paid' เสมอไป แต่ลองใช้เงื่อนไขนี้ไปก่อน หรือจะใช้ 'ชำระเงินแล้ว' ถ้าเป็นภาษาไทย
-- จากข้อมูลเก่า shipping table ใช้สถานะภาษาไทย แต่ orders payment_status อาจเป็นภาษาอังกฤษ หรือไทย
-- ตรวจสอบ schema: payment_status varchar(255)
UPDATE customers c
SET last_sale_date = (
    SELECT MAX(o.order_date) 
    FROM orders o 
    WHERE o.customer_id = c.customer_id 
    AND (o.payment_status = 'paid' OR o.payment_status = 'ชำระเงินแล้ว')
)
WHERE last_sale_date IS NULL;

-- ============================================
-- Verification Queries
-- ============================================

-- ตรวจสอบผลลัพธ์
SELECT 
    'total_calls updated' as metric,
    COUNT(*) as count 
FROM customers WHERE total_calls > 0
UNION ALL
SELECT 
    'order_count updated',
    COUNT(*) 
FROM customers WHERE order_count > 0
UNION ALL
SELECT 
    'has_sold_before = 1',
    COUNT(*) 
FROM customers WHERE has_sold_before = 1
UNION ALL
SELECT 
    'is_repeat_customer = 1',
    COUNT(*) 
FROM customers WHERE is_repeat_customer = 1
UNION ALL
SELECT 
    'follow_up_count updated',
    COUNT(*) 
FROM customers WHERE follow_up_count > 0;

-- ดูตัวอย่างข้อมูล
SELECT 
    customer_id,
    first_name,
    last_name,
    total_calls,
    order_count,
    total_purchases,
    follow_up_count,
    has_sold_before,
    is_new_customer,
    is_repeat_customer,
    first_order_date,
    last_order_date
FROM customers 
WHERE total_calls > 0 OR order_count > 0
LIMIT 20;
