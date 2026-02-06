-- =====================================================
-- Fix Attendance Value Precision (0.9999 → 1.0)
-- Date: 2026-02-06
-- 
-- เฉพาะค่าที่มีปัญหา floating-point precision เท่านั้น
-- ไม่กระทบค่าที่ใส่มือแล้ว (ค่าที่เป็น .00, .25, .50, .75)
-- =====================================================

-- ดูก่อนว่ามีกี่ record ที่มีปัญหา
SELECT 
    COUNT(*) as total_affected,
    MIN(attendance_value) as min_val,
    MAX(attendance_value) as max_val
FROM user_daily_attendance
WHERE 
    -- ค่าที่ลงท้ายด้วย 9999 หรือ 0001 (precision issue)
    (attendance_value * 10000) % 1 != 0
    OR CAST(attendance_value AS CHAR) LIKE '%.999%'
    OR CAST(attendance_value AS CHAR) LIKE '%.0001%'
    OR CAST(attendance_value AS CHAR) LIKE '%.9998%'
    OR CAST(attendance_value AS CHAR) LIKE '%.0002%';

-- Preview ก่อน (ดู 20 record แรก)
SELECT 
    id,
    user_id,
    work_date,
    attendance_value AS old_value,
    ROUND(attendance_value, 2) AS new_value,
    notes
FROM user_daily_attendance
WHERE 
    attendance_value != ROUND(attendance_value, 2)
    AND ABS(attendance_value - ROUND(attendance_value, 2)) < 0.01  -- ต่างกันน้อยกว่า 0.01 (precision issue)
LIMIT 20;

-- =====================================================
-- RUN THIS TO FIX (หลังจากตรวจสอบ Preview แล้ว)
-- =====================================================

/*
UPDATE user_daily_attendance
SET attendance_value = ROUND(attendance_value, 2)
WHERE 
    attendance_value != ROUND(attendance_value, 2)
    AND ABS(attendance_value - ROUND(attendance_value, 2)) < 0.01;
*/

-- ตรวจสอบหลัง fix
-- SELECT COUNT(*) FROM user_daily_attendance WHERE attendance_value != ROUND(attendance_value, 2);
