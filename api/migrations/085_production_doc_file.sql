-- 085: เก็บ "ตัวไฟล์" PDF ของใบ SO/ใบขน ไว้ในระบบ ไม่ใช่แค่ชื่อไฟล์
--
-- ที่มา: 084 เก็บได้แค่ค่าที่อ่านออกมาจากเอกสาร (source_file = ชื่อไฟล์เฉย ๆ)
-- พอจะย้อนดูหลักฐานทีต้องไปไล่หาไฟล์ในเครื่องคนคีย์ ระบบจึงเก็บไฟล์จริงไว้ให้
-- แล้วเปิดดูได้จากหน้ารายการตลอด
--
-- ไฟล์อยู่บนดิสก์ (api/uploads/production_docs/YYYYMM/xxx.pdf) ไม่ได้ยัดลง DB
-- เพราะ backup ฐานข้อมูลจะบวมโดยไม่จำเป็น -- DB เก็บแค่ path กับขนาด
--
-- เพิ่มอย่างเดียว NULL ได้หมด รันซ้ำได้ (MariaDB 10.6+)

ALTER TABLE `production_orders`
  ADD COLUMN IF NOT EXISTS `source_path` varchar(255) DEFAULT NULL
      COMMENT 'ที่อยู่ไฟล์ PDF ต้นทางบนเซิร์ฟเวอร์ เช่น uploads/production_docs/202608/xxx.pdf' AFTER `source_file`,
  ADD COLUMN IF NOT EXISTS `source_size` int(11) DEFAULT NULL
      COMMENT 'ขนาดไฟล์ (ไบต์)' AFTER `source_path`;

ALTER TABLE `production_delivery_notes`
  ADD COLUMN IF NOT EXISTS `source_path` varchar(255) DEFAULT NULL
      COMMENT 'ที่อยู่ไฟล์ PDF ต้นทางบนเซิร์ฟเวอร์' AFTER `source_file`,
  ADD COLUMN IF NOT EXISTS `source_size` int(11) DEFAULT NULL
      COMMENT 'ขนาดไฟล์ (ไบต์)' AFTER `source_path`;
