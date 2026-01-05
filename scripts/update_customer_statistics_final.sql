-- ============================================
-- SQL Script: Update Customer Statistics (FINAL)
-- ============================================

-- เปลี่ยนชื่อ Procedure เป็นชื่อใหม่เพื่อให้รันผ่านแน่นอน
DROP PROCEDURE IF EXISTS UpdateCustomerStatsFinal;

DELIMITER $$

CREATE PROCEDURE UpdateCustomerStatsFinal()
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE batch_size INT DEFAULT 500;
    DECLARE offset_val INT DEFAULT 0;
    DECLARE total_rows INT;
    
    -- สร้างตารางชั่วคราว
    DROP TEMPORARY TABLE IF EXISTS temp_batch_stats;
    CREATE TEMPORARY TABLE temp_batch_stats (
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
    
    -- ใส่ข้อมูลลูกค้าทั้งหมดลงตารางชั่วคราว
    INSERT INTO temp_batch_stats (customer_id)
    SELECT customer_id FROM customers;
    
    SET total_rows = (SELECT COUNT(*) FROM temp_batch_stats);
    
    -- คำนวณสถิติลงตารางชั่วคราวทีเดียว
    -- Calls
    UPDATE temp_batch_stats t
    INNER JOIN (SELECT customer_id, COUNT(*) as cnt FROM call_history GROUP BY customer_id) src 
    ON t.customer_id = src.customer_id SET t.total_calls = src.cnt;
    
    -- Orders
    UPDATE temp_batch_stats t
    INNER JOIN (SELECT customer_id, COUNT(*) as cnt, SUM(total_amount) as sum_amt, MIN(order_date) as first_dt, MAX(order_date) as last_dt FROM orders GROUP BY customer_id) src 
    ON t.customer_id = src.customer_id SET t.order_count = src.cnt, t.total_purchases = src.sum_amt, t.first_order_date = src.first_dt, t.last_order_date = src.last_dt;
    
    -- Appointments
    UPDATE temp_batch_stats t
    INNER JOIN (SELECT customer_id, COUNT(*) as cnt, MAX(date) as last_dt FROM appointments GROUP BY customer_id) src 
    ON t.customer_id = src.customer_id SET t.follow_up_count = src.cnt, t.last_follow_up_date = src.last_dt;
    
    -- Loop Update ตารางจริงทีละ Batch
    WHILE offset_val < total_rows DO
        UPDATE customers c
        INNER JOIN (
            SELECT * FROM temp_batch_stats 
            LIMIT offset_val, batch_size
        ) t ON c.customer_id = t.customer_id
        SET 
            c.total_calls = t.total_calls,
            c.order_count = t.order_count,
            c.total_purchases = t.total_purchases,
            c.first_order_date = t.first_order_date,
            c.last_order_date = t.last_order_date,
            c.follow_up_count = t.follow_up_count,
            c.last_follow_up_date = t.last_follow_up_date,
            c.has_sold_before = CASE WHEN t.order_count > 0 THEN 1 ELSE 0 END,
            c.is_new_customer = CASE WHEN t.order_count = 0 THEN 1 ELSE 0 END,
            c.is_repeat_customer = CASE WHEN t.order_count > 1 THEN 1 ELSE 0 END;
            
        SET offset_val = offset_val + batch_size;
    END WHILE;
    
    SELECT CONCAT('Updated ', total_rows, ' customers successfully') as result;
    
    DROP TEMPORARY TABLE IF EXISTS temp_batch_stats;
END$$

DELIMITER ;

CALL UpdateCustomerStatsFinal();
