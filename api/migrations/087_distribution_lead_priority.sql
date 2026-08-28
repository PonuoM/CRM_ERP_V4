-- 087_distribution_lead_priority.sql
--
-- ที่มา: 25 ส.ค. 2026 ทีม CRM แจ้งว่าได้รับ "รายชื่อที่เพิ่งโทรไป" (เพิ่งหลุดจากมือคนอื่นเข้าถังกลาง)
--        แทนที่จะได้รายชื่อที่ยังไม่เคยโทร ทำให้แจกไปแล้วไม่เกิดผล
--
-- สาเหตุที่ตรวจพบ (ดู CustomerDistributionV2.tsx pool.sort):
--        หน้าเว็บเรียง pool ใหม่แบบ most-constrained-first ทุกครั้ง ไม่ว่าจะเปิด Smart Allocation หรือไม่
--        พอ Smart Allocation ปิด (ค่า default) จึงหยิบ "รายชื่อที่เพิ่งหลุดจากมือพนักงานที่เลือก" ขึ้นมาก่อน
--        แล้วส่งกลับไปหาคนเดิม — วัดจริง 10 วันย้อนหลัง ~90% ของ session แจกคืนคนเดิม 100%
--        (ค่าฐานในถังอยู่ที่ 6% เท่านั้น = สูงกว่าค่าสุ่ม 16 เท่า)
--
-- migration นี้เตรียมข้อมูลให้ handleBasketCustomers() เรียงลำดับการแจกใหม่ได้:
--        ลำดับ 0  A1  ไม่เคยกดโทรเลย         → ยอดปีนี้ DESC → ยอดสะสม DESC
--        ลำดับ 1  B   เคยโทรติด + พ้น cooldown → โทรติดล่าสุด ASC (เก่าสุดก่อน)
--        ลำดับ 2  A2  โทรแล้วไม่เคยติด        → พยายามล่าสุด ASC
--        ลำดับ 3  B*  เพิ่งโทรติดใน N วัน      → ท้ายสุด (แจกได้แต่ต้องกดยืนยัน)
--
-- "โทรติด" = call_history.status IN ('รับสาย','ได้คุย')  — ไม่นับ 'ตัดสายทิ้ง' (เคาะ 25 ส.ค. 2026)
-- call_history.duration ใช้ไม่ได้ (99% เป็น 0) จึงต้องอิง status เท่านั้น
--
-- ขอบเขต ณ เวลาที่เขียน: customers 239,422 แถว, call_history 613,438 แถว (166,779 ลูกค้า)
-- รันซ้ำได้ (idempotent)

-- ─────────────────────────────────────────────────────────────
-- 1) คอลัมน์แคชวันโทรบน customers
--    denormalize เพราะถ้า GROUP BY call_history 613k แถวสดทุกครั้งที่เปิดถัง จะช้าเกินรับได้
--    มีจุดเขียน call_history แค่ 2 ที่ (api/index.php, api/webhook_voicecall.php) จึงดูแลง่าย
--
--    หมายเหตุ: `last_call_date` + `last_call_note` เป็นคอลัมน์ที่โค้ดเขียนหาอยู่แล้วตั้งแต่แรก
--    (api/index.php หลัง INSERT call_history, App.tsx, db/db.ts) แต่ **ไม่เคยถูกสร้างบน production**
--    มีแค่สคริปต์ api/add_missing_columns.php ที่ไม่เคยถูกรัน ผลคือ UPDATE ตรงนั้นโยน exception
--    ทุกครั้งแล้วโดน `catch (Throwable $e) { /* ignore */ }` กลืนเงียบ ๆ ทำให้:
--       - total_calls ไม่เคยเพิ่ม (prod: 149,470 ลูกค้าค้างที่ 1, 65,098 ค้างที่ 0)
--       - คอลัมน์ "โน้ตการโทรล่าสุด" บนแดชบอร์ดไม่เคยอัปเดต
--    migration นี้สร้างให้ครบ แล้วแก้จุด INSERT ให้เขียนทั้ง 3 คอลัมน์ในคำสั่งเดียว
-- ─────────────────────────────────────────────────────────────
ALTER TABLE `customers`
    ADD COLUMN IF NOT EXISTS `last_call_date` DATETIME NULL DEFAULT NULL COMMENT 'เวลาที่กดโทรล่าสุด (ติดหรือไม่ติดก็นับ) จาก call_history' AFTER `total_calls`,
    ADD COLUMN IF NOT EXISTS `last_talk_at` DATETIME NULL DEFAULT NULL COMMENT 'เวลาที่โทรติดล่าสุด (status รับสาย/ได้คุย) จาก call_history' AFTER `last_call_date`,
    ADD COLUMN IF NOT EXISTS `last_call_note` TEXT NULL DEFAULT NULL COMMENT 'โน้ตการโทรล่าสุด' AFTER `last_talk_at`;

ALTER TABLE `customers`
    ADD INDEX IF NOT EXISTS `idx_customers_pool_priority` (`company_id`, `current_basket_key`, `assigned_to`, `last_talk_at`);

-- ─────────────────────────────────────────────────────────────
-- 2) index ให้ backfill + query ย้อนหลังเร็วขึ้น
--    เดิมมีแค่ (customer_id) เดี่ยว กับ (caller, date)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE `call_history`
    ADD INDEX IF NOT EXISTS `idx_ch_customer_date_status` (`customer_id`, `date`, `status`);

-- ─────────────────────────────────────────────────────────────
-- 3) ตั้งค่า cooldown + ลำดับกลุ่ม รายถัง
--    lead_group_order เก็บเป็น CSV เพื่อสลับลำดับได้โดยไม่ต้องแก้โค้ด
-- ─────────────────────────────────────────────────────────────
ALTER TABLE `basket_config`
    ADD COLUMN IF NOT EXISTS `cooldown_days` INT NOT NULL DEFAULT 30 COMMENT 'ไม่แจกรายชื่อที่โทรติดภายในกี่วัน (0 = ปิด) — เป็นเส้นเตือน ฝ่าได้โดยกดยืนยัน' AFTER `linked_basket_key`,
    ADD COLUMN IF NOT EXISTS `lead_group_order` VARCHAR(32) NOT NULL DEFAULT 'A1,B,A2' COMMENT 'ลำดับกลุ่มการแจก: A1=ไม่เคยกดโทร, B=เคยโทรติด, A2=โทรแล้วไม่เคยติด (กลุ่มที่ติด cooldown ต่อท้ายเสมอ)' AFTER `cooldown_days`;

-- ─────────────────────────────────────────────────────────────
-- 4) นับจำนวนที่ฝ่า cooldown ในแต่ละรอบแจก เอาไว้ตรวจย้อนหลัง
-- ─────────────────────────────────────────────────────────────
ALTER TABLE `distribution_sessions`
    ADD COLUMN IF NOT EXISTS `cooldown_override_count` INT NOT NULL DEFAULT 0 COMMENT 'จำนวนรายชื่อในรอบนี้ที่ยังติด cooldown แต่ผู้แจกกดยืนยันแจกไปแล้ว' AFTER `undo_skipped_count`;

-- ─────────────────────────────────────────────────────────────
-- 5) Backfill
--
-- ⚠️ ช่วงคาบเกี่ยวก่อน deploy: `last_talk_at` มีแต่โค้ดใหม่เท่านั้นที่เขียน
--    ระหว่างที่รัน migration แล้วแต่ยังไม่ deploy โค้ด ค่าจะไม่อัปเดตตามการโทรใหม่
--    ให้ **รันส่วนที่ 5 นี้ซ้ำอีกครั้งก่อน deploy** (รันซ้ำได้ ปลอดภัย)
--    ส่วน `last_call_date` / `last_call_note` / `total_calls` โค้ดเดิมเขียนได้ทันทีที่คอลัมน์มี
--    date > '2000-01-01' กัน 0000-00-00 ที่มีอยู่จริงในตาราง (TO_DAYS/เปรียบเทียบจะเพี้ยน)
-- ─────────────────────────────────────────────────────────────
UPDATE `customers` c
JOIN (
    SELECT
        customer_id,
        MAX(`date`) AS last_call_date,
        MAX(CASE WHEN `status` IN ('รับสาย', 'ได้คุย') THEN `date` END) AS last_talk_at
    FROM `call_history`
    WHERE `date` > '2000-01-01'
      AND customer_id IS NOT NULL
    GROUP BY customer_id
) ch ON ch.customer_id = c.customer_id
SET c.last_call_date = ch.last_call_date,
    c.last_talk_at = ch.last_talk_at;

-- total_calls ก็ค้างมาตั้งแต่คอลัมน์หายเช่นกัน ถือโอกาสตั้งค่าให้ตรงกับจำนวนแถวจริงใน call_history
UPDATE `customers` c
JOIN (
    SELECT customer_id, COUNT(*) AS n
    FROM `call_history`
    WHERE customer_id IS NOT NULL
    GROUP BY customer_id
) ch ON ch.customer_id = c.customer_id
SET c.total_calls = ch.n;
