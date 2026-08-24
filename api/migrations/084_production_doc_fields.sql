-- 084: เก็บข้อมูลจาก "ใบจองสินค้า/ใบสั่งขาย" (PDF จาก e-acc) ที่นำเข้าอัตโนมัติ
--
-- ที่มา: ตุ๊กตาต้องคีย์ SO/ใบขนจากเอกสารกระดาษทีละบรรทัด ทั้งที่ในไฟล์ PDF
-- มีข้อมูลครบอยู่แล้ว (เลขเอกสาร วันที่ ลูกค้า คลัง รายการสินค้า จำนวน หน่วย ฝ่ายผลิต)
-- ระบบจึงอ่าน PDF แล้วเติมฟอร์มให้ คอลัมน์ชุดนี้ไว้เก็บข้อมูลที่เดิมไม่มีที่ลง
--
-- ทุกคอลัมน์เป็น NULL ได้หมดและเพิ่มอย่างเดียว -- ของเดิมไม่กระทบ รันซ้ำได้ (IF NOT EXISTS)
-- MariaDB 10.6 ขึ้นไป

-- ───────────── SO สั่งผลิต ─────────────
ALTER TABLE `production_orders`
  ADD COLUMN IF NOT EXISTS `customer_code`    varchar(50)  DEFAULT NULL COMMENT 'รหัสลูกค้าตามใบ เช่น CS10-PN000'   AFTER `company_id`,
  ADD COLUMN IF NOT EXISTS `customer_name`    varchar(191) DEFAULT NULL COMMENT 'นามลูกค้าตามใบ'                    AFTER `customer_code`,
  ADD COLUMN IF NOT EXISTS `customer_address` varchar(500) DEFAULT NULL COMMENT 'ที่อยู่ลูกค้าตามใบ'                 AFTER `customer_name`,
  ADD COLUMN IF NOT EXISTS `receive_date`     date         DEFAULT NULL COMMENT 'วันที่รับสินค้าตามใบ (e-acc)'       AFTER `due_date`,
  ADD COLUMN IF NOT EXISTS `warehouse_name`   varchar(120) DEFAULT NULL COMMENT 'คลังปลายทางตามใบ เช่น คลัง Airport center' AFTER `receive_date`,
  ADD COLUMN IF NOT EXISTS `coordinator_name` varchar(120) DEFAULT NULL COMMENT 'ผู้ประสานงานที่เซ็นในใบ'           AFTER `warehouse_name`,
  ADD COLUMN IF NOT EXISTS `source_type`      varchar(20)  NOT NULL DEFAULT 'manual' COMMENT 'manual = คีย์เอง, pdf = นำเข้าจากไฟล์' AFTER `notes`,
  ADD COLUMN IF NOT EXISTS `source_file`      varchar(255) DEFAULT NULL COMMENT 'ชื่อไฟล์ PDF ที่นำเข้า'            AFTER `source_type`,
  ADD COLUMN IF NOT EXISTS `imported_at`      datetime     DEFAULT NULL COMMENT 'เวลาที่นำเข้าจากไฟล์'              AFTER `source_file`;

ALTER TABLE `production_order_items`
  ADD COLUMN IF NOT EXISTS `doc_line_no` smallint(6)  DEFAULT NULL COMMENT 'ลำดับบรรทัดในใบต้นทาง' AFTER `order_id`,
  ADD COLUMN IF NOT EXISTS `doc_sku`     varchar(60)  DEFAULT NULL COMMENT 'รหัสสินค้าตามใบ (เก็บไว้เทียบเวลารหัสในระบบไม่ตรง)' AFTER `product_id`,
  ADD COLUMN IF NOT EXISTS `doc_name`    varchar(255) DEFAULT NULL COMMENT 'ชื่อสินค้าตามใบ' AFTER `doc_sku`,
  ADD COLUMN IF NOT EXISTS `unit`        varchar(30)  DEFAULT NULL COMMENT 'หน่วยตามใบ เช่น ขวด/ซอง/ถุงซิป' AFTER `ordered_qty`,
  ADD COLUMN IF NOT EXISTS `department`  varchar(60)  DEFAULT NULL COMMENT 'ฝ่ายผลิตตามใบ เช่น ปุ๋ยน้ำ/ไบโอ' AFTER `unit`;

-- ───────────── ใบขน ─────────────
ALTER TABLE `production_delivery_notes`
  ADD COLUMN IF NOT EXISTS `customer_code`    varchar(50)  DEFAULT NULL COMMENT 'รหัสลูกค้าตามใบ'        AFTER `factory_id`,
  ADD COLUMN IF NOT EXISTS `customer_name`    varchar(191) DEFAULT NULL COMMENT 'นามลูกค้าตามใบ'         AFTER `customer_code`,
  ADD COLUMN IF NOT EXISTS `doc_receive_date` date         DEFAULT NULL COMMENT 'วันที่รับสินค้าตามใบ'    AFTER `issued_date`,
  ADD COLUMN IF NOT EXISTS `warehouse_name`   varchar(120) DEFAULT NULL COMMENT 'คลังปลายทางตามใบ'       AFTER `warehouse_id`,
  ADD COLUMN IF NOT EXISTS `coordinator_name` varchar(120) DEFAULT NULL COMMENT 'ผู้ประสานงานที่เซ็นในใบ' AFTER `warehouse_name`,
  ADD COLUMN IF NOT EXISTS `driver_name`      varchar(120) DEFAULT NULL COMMENT 'คนขับรถตามใบ'           AFTER `vehicle_note`,
  ADD COLUMN IF NOT EXISTS `driver_phone`     varchar(40)  DEFAULT NULL COMMENT 'เบอร์โทรคนขับ'          AFTER `driver_name`,
  ADD COLUMN IF NOT EXISTS `driver_id_card`   varchar(30)  DEFAULT NULL COMMENT 'เลขบัตรประชาชนคนขับ'    AFTER `driver_phone`,
  ADD COLUMN IF NOT EXISTS `vehicle_plate`    varchar(40)  DEFAULT NULL COMMENT 'เลขทะเบียนรถ'           AFTER `driver_id_card`,
  ADD COLUMN IF NOT EXISTS `source_type`      varchar(20)  NOT NULL DEFAULT 'manual' COMMENT 'manual = คีย์เอง, pdf = นำเข้าจากไฟล์' AFTER `note`,
  ADD COLUMN IF NOT EXISTS `source_file`      varchar(255) DEFAULT NULL COMMENT 'ชื่อไฟล์ PDF ที่นำเข้า' AFTER `source_type`,
  ADD COLUMN IF NOT EXISTS `imported_at`      datetime     DEFAULT NULL COMMENT 'เวลาที่นำเข้าจากไฟล์'   AFTER `source_file`;

ALTER TABLE `production_delivery_note_items`
  ADD COLUMN IF NOT EXISTS `doc_line_no` smallint(6)  DEFAULT NULL COMMENT 'ลำดับบรรทัดในใบต้นทาง' AFTER `delivery_note_id`,
  ADD COLUMN IF NOT EXISTS `doc_sku`     varchar(60)  DEFAULT NULL COMMENT 'รหัสสินค้าตามใบ'        AFTER `order_item_id`,
  ADD COLUMN IF NOT EXISTS `doc_name`    varchar(255) DEFAULT NULL COMMENT 'ชื่อสินค้าตามใบ'        AFTER `doc_sku`,
  ADD COLUMN IF NOT EXISTS `unit`        varchar(30)  DEFAULT NULL COMMENT 'หน่วยตามใบ'             AFTER `qty`;

-- แก้คำเรียกทีมคลังใน comment ของ 083 ให้ตรงกับที่ใช้จริง (Airport ไม่ใช่ iPod)
ALTER TABLE `production_delivery_notes`
  MODIFY COLUMN `status` enum('issued','picked_up','cancelled') NOT NULL DEFAULT 'issued'
    COMMENT 'issued = ผลิตเสร็จรอขน, picked_up = Airport รับไปเข้าคลังแล้ว';
