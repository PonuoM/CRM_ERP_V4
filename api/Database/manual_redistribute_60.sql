-- SQL Script สำหรับกระจายลูกค้าจาก User 60 ไปให้ 5 คน: 1718, 1720, 1721, 63, 59
-- Version แก้ไข: ใช้ 'customer_id' ให้ตรงกับ Database ของคุณ

-- 1. สร้างตารางชั่วคราวเพื่อเรียงลำดับลูกค้า
DROP TEMPORARY TABLE IF EXISTS temp_redistribute;
CREATE TEMPORARY TABLE temp_redistribute (
    temp_id INT AUTO_INCREMENT PRIMARY KEY,
    ref_customer_id INT
);

-- 2. ดึงลูกค้าของ User 60 (Company 7) มาใส่ในตารางชั่วคราว
-- ใช้ 'customer_id' แทน 'id'
INSERT INTO temp_redistribute (ref_customer_id)
SELECT customer_id FROM customers WHERE assigned_to = 60 AND company_id = 7 ORDER BY customer_id;

-- 3. ทำการ Update โดยใช้วิธีหารเอาเศษ (Modulo)
-- ใช้ 'customer_id' ในการ JOIN
UPDATE customers c
JOIN temp_redistribute t ON c.customer_id = t.ref_customer_id
SET c.assigned_to = CASE 
    WHEN t.temp_id % 5 = 1 THEN 1718
    WHEN t.temp_id % 5 = 2 THEN 1720
    WHEN t.temp_id % 5 = 3 THEN 1721
    WHEN t.temp_id % 5 = 4 THEN 63
    ELSE 59 -- กรณีหารลงตัว (เศษ 0)
END;

-- 4. ลบตารางชั่วคราวทิ้ง
DROP TEMPORARY TABLE temp_redistribute;

-- ตรวจสอบผลลัพธ์
-- SELECT assigned_to, COUNT(*) FROM customers WHERE assigned_to IN (1718, 1720, 1721, 63, 59) GROUP BY assigned_to;
