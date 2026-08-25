-- 086: ลายนิ้วมือของไฟล์ต้นทาง เอาไว้จับการอัปใบซ้ำ
--
-- เลขเอกสารมี unique index กันซ้ำอยู่แล้ว (uk_production_so_number / uk_production_dn_number)
-- แต่กันได้แค่ "เลขซ้ำ" ยังมีอีก 2 กรณีที่หลุด:
--   1) อัปไฟล์เดิมซ้ำแต่ยังไม่กดบันทึก -> ผู้ใช้เสียเวลากรอกจนจบแล้วค่อยโดนเด้งตอน save
--   2) ไฟล์เดียวกันถูกคีย์ซ้ำโดยพิมพ์เลขเอกสารต่างไปนิดหน่อย -> เลขไม่ชน ระบบเลยยอมรับ
-- เก็บ sha1 ของไฟล์ไว้จึงเตือนได้ตั้งแต่ตอนอัป ก่อนกรอกฟอร์ม
--
-- เพิ่มอย่างเดียว NULL ได้ ไม่ได้ทำ unique เพราะบางกรณีคีย์ใบเดิมซ้ำโดยตั้งใจ (แก้แล้วออกใหม่)
-- ให้เป็นแค่ "เตือน" ไม่ใช่ "ห้าม"

ALTER TABLE `production_orders`
  ADD COLUMN IF NOT EXISTS `source_hash` char(40) DEFAULT NULL
      COMMENT 'sha1 ของไฟล์ PDF ต้นทาง ใช้เตือนเวลาอัปไฟล์เดิมซ้ำ' AFTER `source_size`;

ALTER TABLE `production_delivery_notes`
  ADD COLUMN IF NOT EXISTS `source_hash` char(40) DEFAULT NULL
      COMMENT 'sha1 ของไฟล์ PDF ต้นทาง ใช้เตือนเวลาอัปไฟล์เดิมซ้ำ' AFTER `source_size`;

-- ค้นด้วย hash ตอนเช็คซ้ำ จึงต้องมี index (ไม่ unique)
CREATE INDEX IF NOT EXISTS `idx_production_orders_source_hash`
  ON `production_orders` (`source_hash`);

CREATE INDEX IF NOT EXISTS `idx_production_dn_source_hash`
  ON `production_delivery_notes` (`source_hash`);
