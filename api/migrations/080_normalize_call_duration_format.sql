-- 080_normalize_call_duration_format.sql
--
-- ปัญหา: OneCall เปลี่ยนรูปแบบคอลัมน์ Duration / RingingDuration ใน CSV export จาก "HH:MM:SS"
--        เป็น "วินาทีล้วน" (เช่น "753") ตั้งแต่ไฟล์ที่ import เป็น batch 228 (อัปเมื่อ 2026-08-10 09:38
--        ครอบ call_date ตั้งแต่ 2026-08-06) และ import_call_records.php เก็บค่าดิบลง DB ตรงๆ
--
-- ผลกระทบ: รายงานทุกหน้าอ่านค่านี้ด้วย TIME_TO_SEC() ซึ่งตีความ string แบบ HHMMSS ไม่ใช่วินาที
--            TIME_TO_SEC('45')  = 45   ✅
--            TIME_TO_SEC('60')  = NULL ❌  (TIME '00:00:60' ไม่มีอยู่จริง) → นับเป็น "ไม่ได้คุย", นาที = 0
--            TIME_TO_SEC('130') = 90   ❌  (ควรเป็น 130)
--          ทำให้ยอด "สายที่ได้คุย" และ "นาทีคุย" ต่ำกว่าจริง 40-60% ตั้งแต่ 2026-08-06
--          เช่น 2026-08-10 (company 1): ได้คุย 642 (จริง 1,106), นาที 1,197 (จริง 2,897)
--
-- ยืนยันว่าค่าใหม่เป็นวินาทีจริง: แถวที่ duration = 753 มี answered_time 09:02:49 → terminated_time
-- 09:15:22 = 12 นาที 33 วินาที = 753 วินาที พอดี
--
-- แก้ที่ต้นทางแล้วใน api/Onecall_DB/import_call_records.php (normalizeDuration())
-- migration นี้ backfill ข้อมูลที่ import เข้ามาก่อนหน้านั้น
--
-- เงื่อนไขอิงรูปแบบข้อมูล ไม่ได้อิง batch_id จึงรันซ้ำได้ (idempotent) — แถวที่เป็น HH:MM:SS แล้วจะไม่ถูกแตะ
-- ขอบเขต ณ เวลาที่เขียน: duration 3,751 แถว + ว่าง 2,209 แถว, ringing_duration 5,770 แถว + ว่าง 190 แถว
-- ทั้งหมดอยู่ใน batch 228-230 (call_date 2026-08-06 ถึง 2026-08-10)

-- 1) วินาทีล้วน → HH:MM:SS
UPDATE call_import_logs
SET duration = SEC_TO_TIME(CAST(duration AS UNSIGNED))
WHERE duration IS NOT NULL
  AND duration <> ''
  AND duration NOT LIKE '%:%';

UPDATE call_import_logs
SET ringing_duration = SEC_TO_TIME(CAST(ringing_duration AS UNSIGNED))
WHERE ringing_duration IS NOT NULL
  AND ringing_duration <> ''
  AND ringing_duration NOT LIKE '%:%';

-- 2) ค่าว่าง → '00:00:00' ให้ตรงกับที่ข้อมูลเดิม (ก่อน 2026-08-06) เก็บสายที่ไม่ได้รับ
--    มีผลกับ AVG(TIME_TO_SEC(duration)) ที่ก่อนหน้านี้นับ '00:00:00' เป็น 0 แต่นับ '' เป็น NULL (ตัดทิ้ง)
UPDATE call_import_logs
SET duration = '00:00:00'
WHERE duration IS NULL OR duration = '';

UPDATE call_import_logs
SET ringing_duration = '00:00:00'
WHERE ringing_duration IS NULL OR ringing_duration = '';
