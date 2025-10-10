-- Warehouse Management Schema
-- สร้างตารางสำหรับระบบจัดการคลังสินค้า

-- ตารางบริษัท (เพิ่มเติมจากที่มีอยู่)
-- เพิ่มคอลัมน์เฉพาะที่ยังไม่มี (ถ้ามีอยู่แล้วจะไม่ทำอะไร)
SET @dbname = DATABASE();
SET @tablename = "companies";

-- เช็คและเพิ่มคอลัมน์ address
SET @exist := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'address');
SET @sqlstmt := IF(@exist = 0, 'ALTER TABLE `companies` ADD COLUMN `address` TEXT DEFAULT NULL', 'SELECT "Column address already exists" AS info');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;

-- เช็คและเพิ่มคอลัมน์ phone
SET @exist := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'phone');
SET @sqlstmt := IF(@exist = 0, 'ALTER TABLE `companies` ADD COLUMN `phone` VARCHAR(64) DEFAULT NULL', 'SELECT "Column phone already exists" AS info');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;

-- เช็คและเพิ่มคอลัมน์ email
SET @exist := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'email');
SET @sqlstmt := IF(@exist = 0, 'ALTER TABLE `companies` ADD COLUMN `email` VARCHAR(255) DEFAULT NULL', 'SELECT "Column email already exists" AS info');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;

-- เช็คและเพิ่มคอลัมน์ tax_id
SET @exist := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'tax_id');
SET @sqlstmt := IF(@exist = 0, 'ALTER TABLE `companies` ADD COLUMN `tax_id` VARCHAR(32) DEFAULT NULL', 'SELECT "Column tax_id already exists" AS info');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;

-- เช็คและเพิ่มคอลัมน์ created_at
SET @exist := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'created_at');
SET @sqlstmt := IF(@exist = 0, 'ALTER TABLE `companies` ADD COLUMN `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP', 'SELECT "Column created_at already exists" AS info');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;

-- เช็คและเพิ่มคอลัมน์ updated_at
SET @exist := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'updated_at');
SET @sqlstmt := IF(@exist = 0, 'ALTER TABLE `companies` ADD COLUMN `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'SELECT "Column updated_at already exists" AS info');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;

-- ตารางคลังสินค้า (ลบตารางเก่าถ้ามี)
CREATE TABLE IF NOT EXISTS `warehouses` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL COMMENT 'ชื่อคลังสินค้า',
  `company_id` int(11) NOT NULL COMMENT 'รหัสบริษัท',
  `address` text NOT NULL COMMENT 'ที่อยู่คลังสินค้า',
  `province` varchar(128) NOT NULL COMMENT 'จังหวัด',
  `district` varchar(128) NOT NULL COMMENT 'อำเภอ',
  `subdistrict` varchar(128) NOT NULL COMMENT 'ตำบล',
  `postal_code` varchar(16) DEFAULT NULL COMMENT 'รหัสไปรษณีย์',
  `phone` varchar(64) DEFAULT NULL COMMENT 'เบอร์โทรศัพท์',
  `email` varchar(255) DEFAULT NULL COMMENT 'อีเมล',
  `manager_name` varchar(255) DEFAULT NULL COMMENT 'ชื่อผู้จัดการคลัง',
  `manager_phone` varchar(64) DEFAULT NULL COMMENT 'เบอร์ผู้จัดการ',
  `responsible_provinces` text DEFAULT NULL COMMENT 'จังหวัดที่รับผิดชอบ (JSON array)',
  `is_active` tinyint(1) NOT NULL DEFAULT 1 COMMENT 'สถานะใช้งาน',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_warehouses_company` (`company_id`),
  KEY `idx_warehouses_province` (`province`),
  KEY `idx_warehouses_active` (`is_active`),
  CONSTRAINT `fk_warehouses_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ตารางสินค้าในคลัง (Stock)
CREATE TABLE IF NOT EXISTS `warehouse_stocks` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `warehouse_id` int(11) NOT NULL COMMENT 'รหัสคลังสินค้า',
  `product_id` int(11) NOT NULL COMMENT 'รหัสสินค้า',
  `lot_number` varchar(128) DEFAULT NULL COMMENT 'หมายเลข Lot',
  `quantity` int(11) NOT NULL DEFAULT 0 COMMENT 'จำนวนคงเหลือ',
  `reserved_quantity` int(11) NOT NULL DEFAULT 0 COMMENT 'จำนวนที่จองไว้',
  `available_quantity` int(11) GENERATED ALWAYS AS (`quantity` - `reserved_quantity`) STORED COMMENT 'จำนวนที่ใช้ได้จริง',
  `expiry_date` date DEFAULT NULL COMMENT 'วันหมดอายุ',
  `purchase_price` decimal(12,2) DEFAULT NULL COMMENT 'ราคาซื้อ',
  `selling_price` decimal(12,2) DEFAULT NULL COMMENT 'ราคาขาย',
  `location_in_warehouse` varchar(255) DEFAULT NULL COMMENT 'ตำแหน่งในคลัง (เช่น A-1-2)',
  `notes` text DEFAULT NULL COMMENT 'หมายเหตุ',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_warehouse_product_lot` (`warehouse_id`, `product_id`, `lot_number`),
  KEY `fk_warehouse_stocks_warehouse` (`warehouse_id`),
  KEY `fk_warehouse_stocks_product` (`product_id`),
  KEY `idx_warehouse_stocks_quantity` (`quantity`),
  KEY `idx_warehouse_stocks_expiry` (`expiry_date`),
  CONSTRAINT `fk_warehouse_stocks_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_warehouse_stocks_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ตารางการเคลื่อนไหวสินค้า (Stock Movement)
CREATE TABLE IF NOT EXISTS `stock_movements` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `warehouse_id` int(11) NOT NULL COMMENT 'รหัสคลังสินค้า',
  `product_id` int(11) NOT NULL COMMENT 'รหัสสินค้า',
  `movement_type` enum('IN','OUT','TRANSFER','ADJUSTMENT') NOT NULL COMMENT 'ประเภทการเคลื่อนไหว',
  `quantity` int(11) NOT NULL COMMENT 'จำนวน',
  `lot_number` varchar(128) DEFAULT NULL COMMENT 'หมายเลข Lot',
  `reference_type` varchar(64) DEFAULT NULL COMMENT 'ประเภทเอกสารอ้างอิง (ORDER, PURCHASE, ADJUSTMENT)',
  `reference_id` varchar(64) DEFAULT NULL COMMENT 'รหัสเอกสารอ้างอิง',
  `reason` varchar(255) DEFAULT NULL COMMENT 'เหตุผล',
  `notes` text DEFAULT NULL COMMENT 'หมายเหตุ',
  `created_by` int(11) NOT NULL COMMENT 'ผู้สร้าง',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_stock_movements_warehouse` (`warehouse_id`),
  KEY `fk_stock_movements_product` (`product_id`),
  KEY `fk_stock_movements_user` (`created_by`),
  KEY `idx_stock_movements_type` (`movement_type`),
  KEY `idx_stock_movements_date` (`created_at`),
  CONSTRAINT `fk_stock_movements_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_stock_movements_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_stock_movements_user` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ตารางการจองสินค้า (Stock Reservation)
CREATE TABLE IF NOT EXISTS `stock_reservations` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `warehouse_id` int(11) NOT NULL COMMENT 'รหัสคลังสินค้า',
  `product_id` int(11) NOT NULL COMMENT 'รหัสสินค้า',
  `order_id` varchar(32) DEFAULT NULL COMMENT 'รหัสออเดอร์',
  `quantity` int(11) NOT NULL COMMENT 'จำนวนที่จอง',
  `lot_number` varchar(128) DEFAULT NULL COMMENT 'หมายเลข Lot',
  `reserved_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่จอง',
  `expires_at` datetime DEFAULT NULL COMMENT 'วันหมดอายุการจอง',
  `status` enum('ACTIVE','RELEASED','EXPIRED') NOT NULL DEFAULT 'ACTIVE' COMMENT 'สถานะการจอง',
  `created_by` int(11) NOT NULL COMMENT 'ผู้จอง',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_stock_reservations_warehouse` (`warehouse_id`),
  KEY `fk_stock_reservations_product` (`product_id`),
  KEY `fk_stock_reservations_order` (`order_id`),
  KEY `fk_stock_reservations_user` (`created_by`),
  KEY `idx_stock_reservations_status` (`status`),
  CONSTRAINT `fk_stock_reservations_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_stock_reservations_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_stock_reservations_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_stock_reservations_user` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- เพิ่มฟิลด์คลังสินค้าในตารางออเดอร์ (เช็คก่อนเพิ่ม)
SET @tablename = "orders";

SET @exist := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'warehouse_id');
SET @sqlstmt := IF(@exist = 0, 'ALTER TABLE `orders` ADD COLUMN `warehouse_id` int(11) DEFAULT NULL COMMENT \'รหัสคลังสินค้าที่จัดส่ง\'', 'SELECT "Column warehouse_id already exists" AS info');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;

-- เพิ่ม index และ foreign key (ถ้ายังไม่มี)
SET @exist := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
  WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND INDEX_NAME = 'fk_orders_warehouse');
SET @sqlstmt := IF(@exist = 0, 'ALTER TABLE `orders` ADD KEY `fk_orders_warehouse` (`warehouse_id`)', 'SELECT "Index fk_orders_warehouse already exists" AS info');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;

SET @exist := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS 
  WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND CONSTRAINT_NAME = 'fk_orders_warehouse');
SET @sqlstmt := IF(@exist = 0, 'ALTER TABLE `orders` ADD CONSTRAINT `fk_orders_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`)', 'SELECT "Foreign key fk_orders_warehouse already exists" AS info');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;

-- เพิ่มข้อมูลตัวอย่าง (ใช้ INSERT IGNORE เพื่อข้าม record ที่มีอยู่แล้ว)
INSERT IGNORE INTO `companies` (`id`, `name`, `address`, `phone`, `email`, `tax_id`) VALUES
(1, 'Alpha Seeds Co.', '123 ถนนสุขุมวิท กรุงเทพฯ 10110', '02-123-4567', 'info@alphaseeds.com', '0123456789012'),
(2, 'Beta Agriculture Ltd.', '456 ถนนพหลโยธิน เชียงใหม่ 50000', '053-123-456', 'info@betaagriculture.com', '0123456789013');

-- อัพเดทข้อมูลบริษัทที่มีอยู่แล้ว
UPDATE `companies` SET 
  `address` = '123 ถนนสุขุมวิท กรุงเทพฯ 10110',
  `phone` = '02-123-4567',
  `email` = 'info@alphaseeds.com',
  `tax_id` = '0123456789012'
WHERE `id` = 1;

UPDATE `companies` SET 
  `address` = '456 ถนนพหลโยธิน เชียงใหม่ 50000',
  `phone` = '053-123-456',
  `email` = 'info@betaagriculture.com',
  `tax_id` = '0123456789013'
WHERE `id` = 2;

INSERT INTO `warehouses` (`name`, `company_id`, `address`, `province`, `district`, `subdistrict`, `postal_code`, `phone`, `manager_name`, `manager_phone`, `responsible_provinces`) VALUES
('คลังกรุงเทพ', 1, '123 ถนนสุขุมวิท', 'กรุงเทพมหานคร', 'คลองเตย', 'คลองเตย', '10110', '02-123-4567', 'สมชาย ใจดี', '081-234-5678', '["กรุงเทพมหานคร", "นนทบุรี", "ปทุมธานี", "สมุทรปราการ", "สมุทรสาคร"]'),
('คลังเชียงใหม่', 1, '456 ถนนนิมมานเหมินท์', 'เชียงใหม่', 'เมืองเชียงใหม่', 'ศรีภูมิ', '50200', '053-123-456', 'สมหญิง รักดี', '082-345-6789', '["เชียงใหม่", "เชียงราย", "ลำปาง", "ลำพูน", "แม่ฮ่องสอน"]'),
('คลังอุดรธานี', 1, '789 ถนนโพศรี', 'อุดรธานี', 'เมืองอุดรธานี', 'หมากแข้ง', '41000', '042-123-456', 'วิชัย เก่งมาก', '083-456-7890', '["อุดรธานี", "หนองคาย", "เลย", "หนองบัวลำภู", "สกลนคร"]'),
('คลังขอนแก่น', 2, '321 ถนนมิตรภาพ', 'ขอนแก่น', 'เมืองขอนแก่น', 'ในเมือง', '40000', '043-123-456', 'มาลี สวยงาม', '084-567-8901', '["ขอนแก่น", "มหาสารคาม", "ร้อยเอ็ด", "กาฬสินธุ์", "ชัยภูมิ"]');

-- เพิ่มข้อมูลสินค้าในคลัง
INSERT INTO `warehouse_stocks` (`warehouse_id`, `product_id`, `lot_number`, `quantity`, `expiry_date`, `purchase_price`, `selling_price`, `location_in_warehouse`) VALUES
(1, 1, 'LOT-2024-001', 100, '2025-12-31', 100.00, 200.00, 'A-1-1'),
(1, 2, 'LOT-2024-002', 50, '2025-11-30', 80.00, 200.00, 'A-1-2'),
(1, 3, 'LOT-2024-003', 200, '2025-10-31', 50.00, 120.00, 'A-2-1'),
(2, 1, 'LOT-2024-004', 80, '2025-12-31', 100.00, 200.00, 'B-1-1'),
(2, 2, 'LOT-2024-005', 30, '2025-11-30', 80.00, 200.00, 'B-1-2'),
(3, 1, 'LOT-2024-006', 60, '2025-12-31', 100.00, 200.00, 'C-1-1'),
(4, 1, 'LOT-2024-007', 40, '2025-12-31', 100.00, 200.00, 'D-1-1');
