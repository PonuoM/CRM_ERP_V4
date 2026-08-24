-- 083: ระบบสั่งผลิตโรงงาน + ใบขน (Factory Production & Delivery Note)
--
-- แยกเมนูจาก "แพลนรับสินค้า" (stock_arrival_*) แต่ใช้แคตตาล็อกสินค้าตัวเดียวกัน
-- (stock_arrival_products) เพราะเป็นสินค้าชุดเดียวกันทั้งสองระบบ
--
-- เวิร์กโฟลว์ตามที่ประชุม (4 ขั้น):
--   1) ตุ๊กตาคีย์ SO จาก e-acc เข้าระบบ (รอบครึ่งเดือน) + เลือกโรงงานผลิต 1/2/3
--   2) โรงงานผลิต -> ยอดฝั่งโรงงานแตกเป็น "ยังไม่ผลิต" กับ "ผลิตเสร็จรอขน"
--   3) ผลิตเสร็จแต่ละล็อต -> โรงงานออก "ใบขน" -> ตุ๊กตาคีย์เลขใบขนเข้าระบบ
--   4) Airport ขับรถมารับ -> ตุ๊กตากดรับเข้า -> ยอดย้ายจากโรงงานเข้าคลังกาญจนบุรี
--
-- ยอดคงเหลือไม่เก็บเป็นคอลัมน์ แต่คำนวณสดจากใบขนเสมอ เพื่อให้บาลานซ์กับ SO เองอัตโนมัติ:
--   ยังไม่ผลิต   = ordered_qty - SUM(ใบขนที่ไม่ถูกยกเลิก)
--   รอขนย้าย     = SUM(ใบขนสถานะ issued)
--   เข้าคลังแล้ว = SUM(ใบขนสถานะ picked_up)

-- ───────────────────────────── 1) โรงงานผลิต ─────────────────────────────
CREATE TABLE IF NOT EXISTS `production_factories` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `code` varchar(16) NOT NULL,
  `name` varchar(128) NOT NULL,
  `note` varchar(255) DEFAULT NULL,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_production_factories_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='โรงงานผลิต (การ 1/2/3)';

INSERT IGNORE INTO `production_factories` (`code`, `name`, `sort_order`) VALUES
  ('F1', 'โรงงาน 1 (การ 1)', 1),
  ('F2', 'โรงงาน 2 (การ 2)', 2),
  ('F3', 'โรงงาน 3 (การ 3)', 3);

-- โรงงานเริ่มต้นต่อสินค้า (เช่น ปุ๋ยอินทรีย์ -> การ 3 เสมอ) -- ตุ๊กตาเลือกทับได้ตอนเปิด SO
-- ห่อด้วย guard เพื่อให้รันซ้ำได้ (เผื่อไฟล์นี้ถูกรันค้างกลางทางแล้วต้องรันใหม่)
SET @has_default_factory := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'stock_arrival_products'
    AND COLUMN_NAME = 'default_factory_id'
);
SET @ddl_default_factory := IF(@has_default_factory = 0,
  'ALTER TABLE `stock_arrival_products` ADD COLUMN `default_factory_id` int(11) NULL DEFAULT NULL AFTER `format_code`',
  'DO 0');
PREPARE stmt_default_factory FROM @ddl_default_factory;
EXECUTE stmt_default_factory;
DEALLOCATE PREPARE stmt_default_factory;

-- ───────────────────────────── 2) SO สั่งผลิต ─────────────────────────────
CREATE TABLE IF NOT EXISTS `production_orders` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `so_number` varchar(64) NOT NULL,
  `company_id` int(11) DEFAULT NULL,
  `factory_id` int(11) NOT NULL,
  `so_date` date NOT NULL,
  `period_start` date DEFAULT NULL COMMENT 'รอบครึ่งเดือน: วันเริ่ม',
  `period_end` date DEFAULT NULL COMMENT 'รอบครึ่งเดือน: วันจบ',
  `due_date` date DEFAULT NULL COMMENT 'กำหนดผลิตเสร็จ (ถ้ามี)',
  `status` enum('open','closed','cancelled') NOT NULL DEFAULT 'open'
      COMMENT 'closed = ปิดยอดเอง (ผลิตไม่ครบแล้วเลิก); ความคืบหน้าคำนวณสดจากใบขน',
  `notes` text DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `closed_by` int(11) DEFAULT NULL,
  `closed_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_production_orders_so` (`so_number`),
  KEY `idx_production_orders_factory_date` (`factory_id`,`so_date`),
  KEY `idx_production_orders_company` (`company_id`,`so_date`),
  KEY `idx_production_orders_status` (`status`),
  CONSTRAINT `fk_production_orders_factory` FOREIGN KEY (`factory_id`) REFERENCES `production_factories` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_production_orders_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='ใบสั่งผลิต (SO) ที่คีย์มาจาก e-acc';

CREATE TABLE IF NOT EXISTS `production_order_items` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL COMMENT 'stock_arrival_products.id',
  `ordered_qty` int(11) NOT NULL,
  `note` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_production_order_items_order` (`order_id`),
  KEY `idx_production_order_items_product` (`product_id`),
  CONSTRAINT `fk_production_order_items_order` FOREIGN KEY (`order_id`) REFERENCES `production_orders` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `fk_production_order_items_product` FOREIGN KEY (`product_id`) REFERENCES `stock_arrival_products` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='รายการสินค้าใน SO สั่งผลิต';

-- ───────────────────────────── 3) ใบขน ─────────────────────────────
CREATE TABLE IF NOT EXISTS `production_delivery_notes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `dn_number` varchar(64) NOT NULL COMMENT 'เลขใบขนที่โรงงานออก -- หลักฐานเรียกเก็บเงินกับเทพมงคล',
  `factory_id` int(11) NOT NULL,
  `issued_date` date NOT NULL COMMENT 'วันที่โรงงานออกใบขน',
  `status` enum('issued','picked_up','cancelled') NOT NULL DEFAULT 'issued'
      COMMENT 'issued = ผลิตเสร็จรอขน, picked_up = Airport รับไปเข้าคลังแล้ว',
  `warehouse_id` int(11) DEFAULT NULL COMMENT 'คลังปลายทาง (คลังกาญจนบุรี)',
  `received_date` date DEFAULT NULL,
  `picked_up_by` int(11) DEFAULT NULL,
  `picked_up_at` datetime DEFAULT NULL,
  `vehicle_note` varchar(255) DEFAULT NULL COMMENT 'ทะเบียนรถ/คนขับ (ถ้ากรอก)',
  `note` text DEFAULT NULL,
  `posted_to_stock` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'เผื่อเฟสถัดไป: ยิงเข้า stock_movements แล้วหรือยัง',
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_production_dn_number` (`dn_number`),
  KEY `idx_production_dn_factory_date` (`factory_id`,`issued_date`),
  KEY `idx_production_dn_status` (`status`),
  CONSTRAINT `fk_production_dn_factory` FOREIGN KEY (`factory_id`) REFERENCES `production_factories` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_production_dn_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='ใบขนที่โรงงานออกเมื่อผลิตเสร็จแต่ละล็อต';

CREATE TABLE IF NOT EXISTS `production_delivery_note_items` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `delivery_note_id` int(11) NOT NULL,
  `order_item_id` int(11) NOT NULL COMMENT 'ผูกกลับไปที่บรรทัดของ SO -- ทำให้ยอดบาลานซ์กับ SO ได้',
  `qty` int(11) NOT NULL COMMENT 'ยอดตามใบขน (ที่โรงงานผลิตเสร็จ)',
  `received_qty` int(11) DEFAULT NULL COMMENT 'ยอดที่คลังรับจริง -- ต่างจาก qty เมื่อของมาไม่ครบ',
  `note` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_production_dn_items_dn` (`delivery_note_id`),
  KEY `idx_production_dn_items_order_item` (`order_item_id`),
  CONSTRAINT `fk_production_dn_items_dn` FOREIGN KEY (`delivery_note_id`) REFERENCES `production_delivery_notes` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `fk_production_dn_items_order_item` FOREIGN KEY (`order_item_id`) REFERENCES `production_order_items` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='รายการสินค้าในใบขน (1 ใบขนมีได้หลาย SKU)';

-- ───────────────────────────── 4) สิทธิ์ ─────────────────────────────
-- can_manage = เปิด SO / คีย์ใบขน / กดรับเข้าคลังได้
-- Super Admin / Admin Control / CEO มีสิทธิ์อยู่แล้วโดยไม่ต้องมีแถวในตารางนี้
-- (ดู api/inventory/production_permission.php -- ต้องแก้ทั้งสองที่ถ้าจะเปลี่ยนกติกา)
CREATE TABLE IF NOT EXISTS `production_managers` (
  `user_id` int(11) NOT NULL,
  `can_manage` tinyint(1) NOT NULL DEFAULT 1,
  `granted_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`user_id`),
  CONSTRAINT `fk_production_managers_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='บัญชีที่แก้ไขข้อมูลสั่งผลิต/ใบขนได้';

-- จำกัดขอบเขตการมองเห็นของบัญชี read-only ฝั่งโรงงาน
-- ไม่มีแถว = เห็นทุกโรงงาน (ใช้กับทีมคลัง Airport ที่ต้องเห็นภาพรวม)
-- มีแถว    = เห็นเฉพาะโรงงานของตัวเอง (น้องเนม ฯลฯ)
CREATE TABLE IF NOT EXISTS `production_user_factories` (
  `user_id` int(11) NOT NULL,
  `factory_id` int(11) NOT NULL,
  `granted_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`user_id`,`factory_id`),
  KEY `idx_production_user_factories_factory` (`factory_id`),
  CONSTRAINT `fk_production_uf_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `fk_production_uf_factory` FOREIGN KEY (`factory_id`) REFERENCES `production_factories` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='ล็อกให้บัญชีเห็นเฉพาะโรงงานที่กำหนด';
