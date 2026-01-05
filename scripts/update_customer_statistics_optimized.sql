-- ============================================
-- SQL Script: Update Customer Statistics (Optimized)
-- Description: อัปเดตสถิติลูกค้าแบบ High Performance (ลด Lock Timeout)
-- ============================================

-- เพิ่ม Index เพื่อความเร็ว (ถ้ายังไม่มี)
-- หมายเหตุ: ถ้า error ว่ามีอยู่แล้ว ให้ข้ามบรรทัดนี้ไป
-- CREATE INDEX idx_appointments_customer_id ON appointments(customer_id);
-- CREATE INDEX idx_orders_customer_id ON orders(customer_id);
-- CREATE INDEX idx_call_history_customer_id ON call_history(customer_id);

-- 1. อัปเดต total_calls (ใช้ JOIN)
UPDATE customers c
INNER JOIN (
    SELECT customer_id, COUNT(*) as cnt 
    FROM call_history 
    GROUP BY customer_id
) ch ON c.customer_id = ch.customer_id
SET c.total_calls = ch.cnt;

-- 2. อัปเดต order_count และ total_purchases (ใช้ JOIN)
UPDATE customers c
INNER JOIN (
    SELECT 
        customer_id, 
        COUNT(*) as cnt, 
        COALESCE(SUM(total_amount), 0) as sum_amount
    FROM orders 
    GROUP BY customer_id
) o ON c.customer_id = o.customer_id
SET 
    c.order_count = o.cnt,
    c.total_purchases = o.sum_amount;

-- 3. อัปเดต first_order_date และ last_order_date
UPDATE customers c
INNER JOIN (
    SELECT 
        customer_id, 
        MIN(order_date) as first_date,
        MAX(order_date) as last_date
    FROM orders 
    GROUP BY customer_id
) o ON c.customer_id = o.customer_id
SET 
    c.first_order_date = o.first_date,
    c.last_order_date = o.last_date;

-- 4. อัปเดต has_sold_before
UPDATE customers c
SET c.has_sold_before = 1
WHERE c.order_count > 0;

-- 5. อัปเดต is_new_customer และ is_repeat_customer
UPDATE customers c
SET 
    c.is_new_customer = CASE WHEN c.order_count = 0 THEN 1 ELSE 0 END,
    c.is_repeat_customer = CASE WHEN c.order_count > 1 THEN 1 ELSE 0 END
WHERE c.order_count IS NOT NULL;

-- 6. อัปเดต follow_up_count และ last_follow_up_date (ใช้ JOIN)
-- จุดที่เคยมีปัญหา Lock wait timeout
UPDATE customers c
INNER JOIN (
    SELECT 
        customer_id, 
        COUNT(*) as cnt,
        MAX(date) as last_date
    FROM appointments 
    GROUP BY customer_id
) a ON c.customer_id = a.customer_id
SET 
    c.follow_up_count = a.cnt,
    c.last_follow_up_date = a.last_date;

-- 7. อัปเดต last_sale_date
UPDATE customers c
INNER JOIN (
    SELECT 
        customer_id, 
        MAX(order_date) as last_paid_date
    FROM orders 
    WHERE payment_status = 'paid' OR payment_status = 'ชำระเงินแล้ว' OR payment_status = 'อนุมัติแล้ว'
    GROUP BY customer_id
) o ON c.customer_id = o.customer_id
SET c.last_sale_date = o.last_paid_date;

-- ============================================
-- Verification Queries
-- ============================================
SELECT 
    'Result' as metric,
    COUNT(*) as customers_with_orders 
FROM customers 
WHERE order_count > 0;
