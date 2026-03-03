-- ============================================================
-- Warehouse V2 Schema
-- Date: 2026-03-02
-- Description: Complete new inventory system (V2)
--   - Prefix: inv2_
--   - Independent from V1 tables
--   - References existing: warehouses, products, users
-- ============================================================

SET NAMES utf8mb4;

-- 1. Stock Orders (SO — คำสั่งซื้อสินค้า)
CREATE TABLE IF NOT EXISTS `inv2_stock_orders` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `so_number` VARCHAR(50) NOT NULL COMMENT 'เลขที่ SO (SO-YYYYMMDD-XXXXX)',
  `warehouse_id` INT NOT NULL COMMENT 'คลังปลายทาง',
  `order_date` DATE NOT NULL COMMENT 'วันที่สั่ง',
  `expected_date` DATE NULL COMMENT 'วันที่คาดว่าจะเข้า',
  `status` ENUM('Draft','Ordered','Partial','Completed','Cancelled') NOT NULL DEFAULT 'Draft',
  `notes` TEXT NULL,
  `images` JSON NULL COMMENT 'Array of image paths',
  `created_by` INT NOT NULL,
  `company_id` INT NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_so_number` (`so_number`),
  KEY `idx_so_warehouse` (`warehouse_id`),
  KEY `idx_so_status` (`status`),
  KEY `idx_so_date` (`order_date`),
  KEY `idx_so_company` (`company_id`),
  CONSTRAINT `fk_inv2_so_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`),
  CONSTRAINT `fk_inv2_so_user` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Stock Order Items (รายการสินค้าใน SO)
CREATE TABLE IF NOT EXISTS `inv2_stock_order_items` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `stock_order_id` INT NOT NULL,
  `product_id` INT NOT NULL,
  `variant` VARCHAR(255) NULL COMMENT 'รุ่น',
  `quantity` DECIMAL(12,2) NOT NULL COMMENT 'จำนวนที่สั่ง',
  `received_quantity` DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT 'จำนวนที่รับแล้ว',
  `unit_cost` DECIMAL(12,2) NULL COMMENT 'ราคาต่อหน่วย',
  `notes` TEXT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_soi_order` (`stock_order_id`),
  KEY `idx_soi_product` (`product_id`),
  CONSTRAINT `fk_inv2_soi_order` FOREIGN KEY (`stock_order_id`) REFERENCES `inv2_stock_orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_inv2_soi_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Receive Documents (เอกสารรับเข้า)
CREATE TABLE IF NOT EXISTS `inv2_receive_documents` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `doc_number` VARCHAR(50) NOT NULL COMMENT 'เลขที่เอกสาร (RCV-YYYYMMDD-XXXXX)',
  `stock_order_id` INT NULL COMMENT 'อ้างอิง SO (ถ้ามี)',
  `warehouse_id` INT NOT NULL,
  `receive_date` DATE NOT NULL,
  `notes` TEXT NULL,
  `images` JSON NULL COMMENT 'Array of image paths',
  `created_by` INT NOT NULL,
  `company_id` INT NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_rcv_doc_number` (`doc_number`),
  KEY `idx_rcv_so` (`stock_order_id`),
  KEY `idx_rcv_warehouse` (`warehouse_id`),
  KEY `idx_rcv_date` (`receive_date`),
  KEY `idx_rcv_company` (`company_id`),
  CONSTRAINT `fk_inv2_rcv_so` FOREIGN KEY (`stock_order_id`) REFERENCES `inv2_stock_orders` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_inv2_rcv_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`),
  CONSTRAINT `fk_inv2_rcv_user` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Receive Items (รายการรับเข้า)
CREATE TABLE IF NOT EXISTS `inv2_receive_items` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `receive_doc_id` INT NOT NULL,
  `so_item_id` INT NULL COMMENT 'อ้างอิง SO item (ถ้ามี)',
  `product_id` INT NOT NULL,
  `variant` VARCHAR(255) NULL COMMENT 'รุ่น',
  `lot_number` VARCHAR(128) NULL COMMENT 'หมายเลข Lot',
  `quantity` DECIMAL(12,2) NOT NULL,
  `unit_cost` DECIMAL(12,2) NULL,
  `mfg_date` DATE NULL COMMENT 'วันผลิต',
  `exp_date` DATE NULL COMMENT 'วันหมดอายุ',
  `notes` TEXT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_ri_doc` (`receive_doc_id`),
  KEY `idx_ri_soi` (`so_item_id`),
  KEY `idx_ri_product` (`product_id`),
  CONSTRAINT `fk_inv2_ri_doc` FOREIGN KEY (`receive_doc_id`) REFERENCES `inv2_receive_documents` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_inv2_ri_soi` FOREIGN KEY (`so_item_id`) REFERENCES `inv2_stock_order_items` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_inv2_ri_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Stock (สต็อกคงเหลือ)
CREATE TABLE IF NOT EXISTS `inv2_stock` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `warehouse_id` INT NOT NULL,
  `product_id` INT NOT NULL,
  `variant` VARCHAR(255) NULL COMMENT 'รุ่น',
  `lot_number` VARCHAR(128) NULL COMMENT 'หมายเลข Lot',
  `quantity` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `mfg_date` DATE NULL COMMENT 'วันผลิต',
  `exp_date` DATE NULL COMMENT 'วันหมดอายุ',
  `unit_cost` DECIMAL(12,2) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_stock` (`warehouse_id`, `product_id`, `variant`, `lot_number`),
  KEY `idx_stock_warehouse` (`warehouse_id`),
  KEY `idx_stock_product` (`product_id`),
  KEY `idx_stock_expiry` (`exp_date`),
  CONSTRAINT `fk_inv2_stock_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`),
  CONSTRAINT `fk_inv2_stock_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Movements (ประวัติการเคลื่อนไหว)
CREATE TABLE IF NOT EXISTS `inv2_movements` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `warehouse_id` INT NOT NULL,
  `product_id` INT NOT NULL,
  `variant` VARCHAR(255) NULL,
  `lot_number` VARCHAR(128) NULL,
  `movement_type` ENUM('IN','OUT','ADJUST_IN','ADJUST_OUT') NOT NULL,
  `quantity` DECIMAL(12,2) NOT NULL COMMENT 'จำนวน (always positive)',
  `reference_type` VARCHAR(50) NULL COMMENT 'receive, dispatch, adjustment',
  `reference_id` INT NULL COMMENT 'ID of source document',
  `reference_doc_number` VARCHAR(50) NULL COMMENT 'เลขที่เอกสาร',
  `reference_order_id` VARCHAR(50) NULL COMMENT 'เลขที่ออเดอร์จากระบบ (ถ้ามี)',
  `notes` TEXT NULL,
  `images` JSON NULL,
  `created_by` INT NOT NULL,
  `company_id` INT NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_mov_warehouse` (`warehouse_id`),
  KEY `idx_mov_product` (`product_id`),
  KEY `idx_mov_type` (`movement_type`),
  KEY `idx_mov_date` (`created_at`),
  KEY `idx_mov_ref` (`reference_type`, `reference_id`),
  KEY `idx_mov_order` (`reference_order_id`),
  KEY `idx_mov_company` (`company_id`),
  CONSTRAINT `fk_inv2_mov_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`),
  CONSTRAINT `fk_inv2_mov_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`),
  CONSTRAINT `fk_inv2_mov_user` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
