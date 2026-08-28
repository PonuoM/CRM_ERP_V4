-- 093 — กล่องรอตรวจ (Challenge Review Inbox) เฟส 1: โครงสร้างข้อมูลอย่างเดียว
--
-- ทีมตัดสินใจว่า "ไม่เอา auto ย้าย" — ระบบมีหน้าที่ชี้เป้า + รวบหลักฐาน การย้ายถัง
-- และการบล็อคเกิดขึ้นเมื่อ sup กดเท่านั้น migration นี้จึงไม่แตะตาราง customers
-- แม้แต่คอลัมน์เดียว สร้างแค่ที่เก็บ "ธง" กับที่เก็บ "เกณฑ์"
--
-- รันซ้ำได้ปลอดภัย (IF NOT EXISTS ทุกจุด — ใช้ได้เพราะ prod เป็น MariaDB 10.6
-- ซึ่งรองรับ ADD COLUMN IF NOT EXISTS ต่างจาก MySQL; ถ้าย้ายไป MySQL ต้องเขียนใหม่)
--
-- วิธีรัน:
--   php C:/AppServ/www/voicecall/ops/db.php erp api/migrations/093_challenge_flags.sql
--
-- ⚠️ lock_wait_timeout ข้างล่างสำคัญมาก อย่าลบ: ครั้งแรกที่รัน migration นี้ ALTER TABLE
-- ไปติดคิว metadata lock หลัง query วิเคราะห์ตัวหนึ่งที่รันอยู่ 8 นาที แล้ว "ทุก query
-- ที่มาทีหลัง" ต่อคิวหลัง ALTER อีกที — หน้าลูกค้าบนเว็บค้างยกแผงทั้งที่ตารางมีแค่ 73 แถว
-- ตั้ง timeout สั้น ๆ ให้ ALTER ยอมแพ้เองแทนที่จะไปขวางทางคนอื่น แล้วค่อยรันใหม่
SET SESSION lock_wait_timeout = 5;

-- ─────────────────────────────────────────────────────────────
-- 1. ตารางธง
-- ─────────────────────────────────────────────────────────────
-- 1 แถว = ลูกค้า 1 ราย ที่เข้าเงื่อนไขของถังปลายทาง 1 ถัง
-- UNIQUE ที่ (customer_id, rule_basket_key) ไม่ใช่ (customer_id, reason) เพราะ 1 ถัง
-- อาจนับหลายผลการโทรรวมกัน (เช่น ฝากสั่ง/รับแทน นับทั้ง 'คนอื่นรับสายแทน' และ
-- 'ฝากส่งไม่ได้ใช้เอง') ถ้า unique ที่ reason จะได้ธงซ้ำถังเดียวกันสองใบ
CREATE TABLE IF NOT EXISTS `challenge_flags` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `company_id` INT(11) NOT NULL,
  `customer_id` INT(11) NOT NULL,
  `rule_basket_key` VARCHAR(50) NOT NULL COMMENT 'ถังปลายทางถ้า sup กดย้าย (basket_key ฝั่ง distribution) หรือ block_customers',
  `reason` VARCHAR(100) NOT NULL COMMENT 'ผลการโทรของสายล่าสุดที่ทำให้ติดธง (ข้อความไทยตรงจาก call_history)',
  `hit_count` INT(11) NOT NULL DEFAULT 0,
  `agent_count` INT(11) NOT NULL DEFAULT 0,
  `first_hit_at` DATETIME DEFAULT NULL,
  `last_hit_at` DATETIME DEFAULT NULL,
  `confidence` ENUM('confirmed','review') NOT NULL DEFAULT 'review' COMMENT 'confirmed = ถึงเกณฑ์จำนวนคนที่กดรวดเดียวได้, review = ต้องเปิดอ่านก่อน',
  `evidence_json` TEXT DEFAULT NULL COMMENT 'ใครบันทึกกี่ครั้ง ครั้งล่าสุดเมื่อไหร่ ผลล่าสุดคืออะไร (ให้ตารางแสดงได้โดยไม่ต้อง query ซ้ำรายแถว)',
  `assigned_to_at_flag` INT(11) DEFAULT NULL COMMENT 'เจ้าของ ณ ตอนติดธง เก็บไว้ดูย้อนหลัง หน้าเว็บให้อ่านเจ้าของสดจาก customers',
  `status` ENUM('pending','moved','dismissed','expired') NOT NULL DEFAULT 'pending',
  `reviewed_by` INT(11) DEFAULT NULL,
  `reviewed_at` DATETIME DEFAULT NULL,
  `review_note` VARCHAR(255) DEFAULT NULL,
  `reviewed_hit_count` INT(11) DEFAULT NULL COMMENT 'จำนวนครั้ง ณ ตอนที่ sup ตัดสินใจ — ใช้ปลุกธงใหม่เมื่อมีสายเพิ่มหลังจากนั้น ไม่ใช่เด้งซ้ำทุกวัน',
  `last_scan_at` DATETIME DEFAULT NULL COMMENT 'รอบสแกนล่าสุดที่ยังเข้าเงื่อนไข — แถว pending ที่ค้างรอบเก่าแปลว่าหลุดเงื่อนไขแล้ว ให้ปิดเป็น expired',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_customer_rule` (`customer_id`, `rule_basket_key`),
  KEY `idx_inbox` (`company_id`, `status`, `rule_basket_key`, `confidence`),
  KEY `idx_last_hit` (`last_hit_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────
-- 2. เกณฑ์ — เก็บใน basket_config ของถังปลายทาง จะได้แก้ผ่านหน้าเว็บทีหลังได้
-- ─────────────────────────────────────────────────────────────
ALTER TABLE `basket_config`
  ADD COLUMN IF NOT EXISTS `flag_results` VARCHAR(255) DEFAULT NULL COMMENT 'ผลการโทรที่นับเข้าเกณฑ์ คั่นด้วยจุลภาค ตรงกับข้อความใน call_history.result/status',
  ADD COLUMN IF NOT EXISTS `flag_min_hits` INT(11) DEFAULT NULL COMMENT 'บันทึกกี่ครั้งถึงขึ้นกล่องรอตรวจ',
  ADD COLUMN IF NOT EXISTS `flag_min_agents` INT(11) DEFAULT NULL COMMENT 'จากพนักงานกี่คนถึงขึ้นกล่องรอตรวจ',
  ADD COLUMN IF NOT EXISTS `flag_confirm_agents` INT(11) DEFAULT NULL COMMENT 'กี่คนถึงนับเป็นยืนยันแล้ว (โซนเขียว กดรวดเดียวได้)',
  ADD COLUMN IF NOT EXISTS `flag_lookback_days` INT(11) DEFAULT NULL COMMENT 'นับย้อนหลังกี่วัน NULL = ไม่จำกัด',
  ADD COLUMN IF NOT EXISTS `flag_is_active` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'เปิดใช้เกณฑ์นี้หรือยัง';

-- ─────────────────────────────────────────────────────────────
-- 3. ค่าตั้งต้นของเกณฑ์
-- ─────────────────────────────────────────────────────────────
-- เกณฑ์ต่างกันตามธรรมชาติของสาเหตุ ไม่ใช่ตัวเลขเดียวทั้งระบบ:
--
--   สภาวะชั่วคราว (ไม่รับสาย/ไม่มีสัญญาณ) — คนเดียวอาจโทรเวลาเดิมทุกครั้ง
--   คนที่ 2-3 ให้ข้อมูลใหม่จริง → ต้อง 3 ครั้ง จาก 3 คน
--
--   ลูกค้าบอกเอง (เลิกทำสวน/ห้ามติดต่อ) — สิ่งที่ยืนยันคือคำพูดของลูกค้า
--   คนที่ 2 โทรไปก็ได้คำตอบเดิม ไม่ได้ข้อมูลใหม่ → 1 คนขึ้นกล่องได้เลย
--   (วัดจริง 90 วัน: เลิกทำสวนมีคนบันทึก 4,074 ราย แต่ครบ 3 คนแค่ 6 ราย = 0.15%
--    ตั้ง 3 คนกับสาเหตุแบบนี้เท่ากับปิดฟีเจอร์ไปในตัว)
--
-- ตัวกันพลาดของสาเหตุกลุ่มหลังคือ sup ต้องเปิดอ่านโน้ตก่อนกด ไม่ใช่การรอคนที่ 3
UPDATE `basket_config` SET
  `flag_results` = 'ไม่รับสาย', `flag_min_hits` = 3, `flag_min_agents` = 3,
  `flag_confirm_agents` = 3, `flag_lookback_days` = 90, `flag_is_active` = 1
WHERE `basket_key` = 'no_answer' AND `company_id` = 1;

UPDATE `basket_config` SET
  `flag_results` = 'ไม่มีสัญญาณ', `flag_min_hits` = 3, `flag_min_agents` = 3,
  `flag_confirm_agents` = 3, `flag_lookback_days` = 90, `flag_is_active` = 1
WHERE `basket_key` = 'no_signal' AND `company_id` = 1;

UPDATE `basket_config` SET
  `flag_results` = 'เลิกทำสวน', `flag_min_hits` = 1, `flag_min_agents` = 1,
  `flag_confirm_agents` = 2, `flag_lookback_days` = 90, `flag_is_active` = 1
WHERE `basket_key` = 'quit_farming' AND `company_id` = 1;

UPDATE `basket_config` SET
  `flag_results` = 'คนอื่นรับสายแทน,ฝากส่งไม่ได้ใช้เอง', `flag_min_hits` = 2, `flag_min_agents` = 2,
  `flag_confirm_agents` = 2, `flag_lookback_days` = 90, `flag_is_active` = 1
WHERE `basket_key` = 'order_for_other' AND `company_id` = 1;

-- 'ห้ามติดต่อ' ไม่ต้องมีถังใหม่ — ปลายทางคือระบบบล็อคเดิม (ถัง 55 + customer_blocks)
-- ซึ่งไม่มี linked_basket_key จึงแจกออกไม่ได้ทางโครงสร้างอยู่แล้ว
UPDATE `basket_config` SET
  `flag_results` = 'ห้ามติดต่อ', `flag_min_hits` = 1, `flag_min_agents` = 1,
  `flag_confirm_agents` = 2, `flag_lookback_days` = 90, `flag_is_active` = 1
WHERE `basket_key` = 'block_customers' AND `company_id` = 1;

-- เบอร์โทรผิดยังเปิดไม่ได้ — ตรวจ call_history ย้อนหลัง 180 วันแล้วไม่มีค่านี้เลยสักแถว
-- เพราะ LogCallModal ไม่มีตัวเลือกให้เทเลกด ต้องเพิ่ม option ก่อนถึงจะมีของไหลเข้า
UPDATE `basket_config` SET
  `flag_results` = NULL, `flag_min_hits` = 2, `flag_min_agents` = 2,
  `flag_confirm_agents` = 2, `flag_lookback_days` = 90, `flag_is_active` = 0
WHERE `basket_key` = 'wrong_phone_number' AND `company_id` = 1;
