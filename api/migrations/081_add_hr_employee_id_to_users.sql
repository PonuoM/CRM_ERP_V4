-- 081: เชื่อม users ของ ERP เข้ากับ employees ของ HR Mobile Connect
--
-- HR Mobile Connect (`primacom_hr_mobile_connect`) อยู่บน MySQL instance เดียวกับ `primacom_mini_erp`
-- และ user `primacom_bloguser` มองเห็นทั้งสอง schema จึง query ข้ามฐานได้ตรง ๆ
-- (`SELECT ... FROM primacom_hr_mobile_connect.employees`) โดยไม่ต้องเปิด connection ที่สอง
--
-- ปัญหาคือไม่มี key เชื่อมคนสองระบบ: `users.id` เป็น INT ส่วน `employees.id` เป็น VARCHAR ('EMP001')
-- และจับคู่จากชื่ออัตโนมัติไม่ได้ เพราะ `users.first_name` ของ ERP จริง ๆ เก็บ "ชื่อเล่น" ไม่ใช่ชื่อจริง
-- (สำรวจเมื่อ 2026-08-17: match ด้วย email ได้ 8 คู่ / ชื่อ-นามสกุลเป๊ะ 6 คู่ / เบอร์โทร 1 คู่
--  แต่ชื่อเล่นตรงกับ employees.nickname ถึง 86 จาก 167 active user)
--
-- คอลัมน์นี้จึงเป็น mapping ที่ "คนยืนยัน" ผ่านหน้า Data Management → HR Employee Mapping
-- seed อัตโนมัติได้เฉพาะคู่ที่ชื่อเล่นตรงแบบไม่กำกวมภายในบริษัทเดียวกัน (~68 คน) ที่เหลือจับคู่ด้วยมือ
--
-- NULL = ยังไม่ผูก (MariaDB ยอมให้ NULL ซ้ำได้ใน UNIQUE index จึงกันเฉพาะการผูกซ้ำคนเดียวกัน)

ALTER TABLE `users`
  ADD COLUMN `hr_employee_id` VARCHAR(20) NULL DEFAULT NULL
    COMMENT 'primacom_hr_mobile_connect.employees.id (เช่น EMP001) — NULL = ยังไม่ผูก' AFTER `id_oth`,
  ADD COLUMN `hr_linked_at` DATETIME NULL DEFAULT NULL
    COMMENT 'เวลาที่ผูก/แก้การผูกครั้งล่าสุด' AFTER `hr_employee_id`,
  ADD COLUMN `hr_linked_by` INT NULL DEFAULT NULL
    COMMENT 'users.id ของคนที่กดผูก' AFTER `hr_linked_at`;

ALTER TABLE `users`
  ADD UNIQUE KEY `uq_users_hr_employee` (`hr_employee_id`);
