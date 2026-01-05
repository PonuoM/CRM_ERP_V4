-- ============================================
-- SQL Script: Update Customer Statistics (Safe Mode)
-- Description: อัปเดตสถิติโดยใช้ Temporary Table เพื่อลดการ Lock
-- ============================================

-- 1. สร้างตารางชั่วคราวสำหรับเก็บสถิติ
DROP TEMPORARY TABLE IF EXISTS temp_customer_stats;
CREATE TEMPORARY TABLE temp_customer_stats (
    customer_id INT PRIMARY KEY,
    total_calls INT DEFAULT 0,
    order_count INT DEFAULT 0,
    total_purchases DECIMAL(15,2) DEFAULT 0,
    first_order_date DATETIME,
    last_order_date DATETIME,
    follow_up_count INT DEFAULT 0,
    last_follow_up_date DATETIME,
    last_sale_date DATETIME
);

-- 2. ใส่ข้อมูลลูกค้าที่มีความเคลื่อนไหวลงในตารางชั่วคราว
-- (ดึง customer_id จาก call_history, orders, appointments)
INSERT IGNORE INTO temp_customer_stats (customer_id)
SELECT customer_id FROM call_history
UNION
SELECT customer_id FROM orders
UNION
SELECT customer_id FROM appointments;

-- 3. คำนวณยอดต่างๆ ลงในตารางชั่วคราว (ทำทีละส่วน)
-- 3.1 Calls
UPDATE temp_customer_stats t
INNER JOIN (
    SELECT customer_id, COUNT(*) as cnt FROM call_history GROUP BY customer_id
) src ON t.customer_id = src.customer_id
SET t.total_calls = src.cnt;

-- 3.2 Orders
UPDATE temp_customer_stats t
INNER JOIN (
    SELECT customer_id, COUNT(*) as cnt, SUM(total_amount) as sum_amt, MIN(order_date) as first_dt, MAX(order_date) as last_dt 
    FROM orders GROUP BY customer_id
) src ON t.customer_id = src.customer_id
SET t.order_count = src.cnt, t.total_purchases = src.sum_amt, t.first_order_date = src.first_dt, t.last_order_date = src.last_dt;

-- 3.3 Appointments
UPDATE temp_customer_stats t
INNER JOIN (
    SELECT customer_id, COUNT(*) as cnt, MAX(date) as last_dt 
    FROM appointments GROUP BY customer_id
) src ON t.customer_id = src.customer_id
SET t.follow_up_count = src.cnt, t.last_follow_up_date = src.last_dt;

-- 3.4 Last Payment Date
UPDATE temp_customer_stats t
INNER JOIN (
    SELECT customer_id, MAX(order_date) as last_dt 
    FROM orders 
    WHERE payment_status IN ('paid', 'ชำระเงินแล้ว', 'อนุมัติแล้ว')
    GROUP BY customer_id
) src ON t.customer_id = src.customer_id
SET t.last_sale_date = src.last_dt;

-- 4. อัปเดตตารางจริงจากตารางชั่วคราว (เร็วขึ้นเพราะ update ตรงๆ ตาม PK)
UPDATE customers c
INNER JOIN temp_customer_stats t ON c.customer_id = t.customer_id
SET 
    c.total_calls = t.total_calls,
    c.order_count = t.order_count,
    c.total_purchases = t.total_purchases,
    c.first_order_date = t.first_order_date,
    c.last_order_date = t.last_order_date,
    c.follow_up_count = t.follow_up_count,
    c.last_follow_up_date = t.last_follow_up_date,
    c.last_sale_date = t.last_sale_date,
    c.has_sold_before = CASE WHEN t.order_count > 0 THEN 1 ELSE 0 END,
    c.is_new_customer = CASE WHEN t.order_count = 0 THEN 1 ELSE 0 END,
    c.is_repeat_customer = CASE WHEN t.order_count > 1 THEN 1 ELSE 0 END;

-- 5. ลบตารางชั่วคราว
DROP TEMPORARY TABLE IF EXISTS temp_customer_stats;

SELECT 'Update Completed Successfully' as status;
