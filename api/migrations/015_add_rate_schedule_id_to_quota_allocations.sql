-- 015_add_rate_schedule_id_to_quota_allocations.sql

-- 1. เพิ่มคอลัมน์ rate_schedule_id เป็น Foreign Key
ALTER TABLE quota_allocations
ADD COLUMN rate_schedule_id INT NULL COMMENT 'FK → quota_rate_schedules.id' AFTER quota_product_id;

-- 2. จัดการข้อมูลเก่า (Backfill) สำหรับ source = 'auto_confirmed' (ดึง ID จาก source_detail และเคลียร์ source_detail ให้ว่าง)
UPDATE quota_allocations 
SET rate_schedule_id = CAST(source_detail AS UNSIGNED),
    source_detail = NULL 
WHERE source = 'auto_confirmed' AND source_detail IS NOT NULL AND source_detail != '';

-- 3. จัดการข้อมูลเก่า (Backfill) สำหรับ source = 'transfer' (ดึง ID จาก string RS:X|... และเอา RS:X| ออกจาก source_detail)
UPDATE quota_allocations
SET rate_schedule_id = CAST(SUBSTRING_INDEX(REPLACE(source_detail, 'RS:', ''), '|', 1) AS UNSIGNED),
    source_detail = SUBSTRING(source_detail, INSTR(source_detail, '|') + 1)
WHERE source = 'transfer' AND source_detail LIKE 'RS:%';

-- 4. จัดการข้อมูลเก่า (Backfill) สำหรับ source = 'admin' (ในกรณีที่มีการเก็บ rsId ลงไปใน source_detail ด้วยวิธีใดๆ ในอดีต ถ้ามีให้แยก)
-- (ตามระบบเดิม admin จะไม่มี RS: นำหน้า และไม่ได้เก็บ ID โดดๆ ดังนั้นให้เก็บไว้เป็น NULL ไปก่อน)
