-- 101 — บันทึกคอลัมน์ customers.followup_bonus_remaining ให้เป็นเรื่องของ migration
--
-- คอลัมน์นี้ถูกสร้างมาแต่เดิมด้วย ensure_schema() ที่ยิง ALTER TABLE ทุกคำขอใน
-- api/ownership_handler.php และ api/ownership.php ซึ่งถอดออกไปแล้ว (2 ก.ย. 2569)
-- เพราะการขอ metadata lock บน customers 240,000+ แถวทุกคำขอ ทำให้ query อื่น
-- ต่อคิวจนเป็นขบวนล็อก และ PHP ที่รออยู่กินแรมค้างจนแรมทั้งบัญชี host หมด
--
-- ไฟล์นี้จึงมีไว้ให้ฐานข้อมูลที่ตั้งใหม่ยังได้คอลัมน์นี้ครบ prod มีอยู่แล้วไม่ต้องรัน
--
-- ⚠️ นิยามตรงนี้ตั้งใจให้ตรงกับของจริงบน prod คือ nullable ไม่ใช่ NOT NULL DEFAULT 1
--    ตามที่ ALTER ตัวเก่าพยายามทำ (มันไม่เคยสำเร็จเพราะคอลัมน์มีอยู่ก่อนแล้ว)
--    ของจริง ณ 2 ก.ย. 2569: ค่า 1 = 174,896 แถว · 0 = 49,275 แถว · NULL = 16,721 แถว
--    โค้ดฝั่ง PHP อ่านค่า NULL เป็น 1 อยู่แล้ว (ownership_handler.php ~บรรทัด 132)

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS followup_bonus_remaining TINYINT(1) NULL DEFAULT NULL
  COMMENT 'โควตาต่ออายุครอบครองที่เหลือ; NULL = ยังไม่เคยใช้ ถือว่าเท่ากับ 1';
