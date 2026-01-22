-- SQL Script สำหรับกระจายลูกค้าจาก User 61 ไปให้ 5 คน: 1718, 1720, 1721, 63, 59
-- รันโค้ดนี้ใน phpMyAdmin เพื่อเปลี่ยนผู้ดูแลทันที

-- 1. สร้างตารางชั่วคราว
DROP TEMPORARY TABLE IF EXISTS temp_redistribute;
CREATE TEMPORARY TABLE temp_redistribute (
    temp_id INT AUTO_INCREMENT PRIMARY KEY,
    ref_customer_id INT
);

-- 2. ดึงลูกค้า (User 61)
INSERT INTO temp_redistribute (ref_customer_id)
SELECT customer_id FROM customers WHERE assigned_to = 61 AND company_id = 7 ORDER BY customer_id;

-- 3. อัปเดตจริง
UPDATE customers c
JOIN temp_redistribute t ON c.customer_id = t.ref_customer_id
SET c.assigned_to = CASE 
    WHEN t.temp_id % 5 = 1 THEN 1718
    WHEN t.temp_id % 5 = 2 THEN 1720
    WHEN t.temp_id % 5 = 3 THEN 1721
    WHEN t.temp_id % 5 = 4 THEN 63
    ELSE 59
END;

-- 4. ล้างตาราง
DROP TEMPORARY TABLE temp_redistribute;
