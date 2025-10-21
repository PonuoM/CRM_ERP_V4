-- Migration: Add order_item_allocations to support warehouse-agnostic order capture
-- Created: 2025-10-17
-- Purpose:
--   1) เก็บความต้องการตัดสต๊อกจากแต่ละรายการสินค้าในออเดอร์ (ทั้งกรณีปกติและรายการย่อยของโปรฯ)
--   2) อนุญาตให้ผู้ขายเปิดออเดอร์ได้โดยไม่ต้องเลือกคลัง/ล็อต (warehouse, lot)
--   3) Backoffice สามารถมากระจาย (allocate) ไปยังคลัง/ล็อตภายหลัง และเชื่อมกับการจองสต๊อก/ตัดสต๊อก

CREATE TABLE IF NOT EXISTS `order_item_allocations` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `order_id` VARCHAR(32) NOT NULL COMMENT 'รหัสออเดอร์',
  `order_item_id` INT(11) NULL DEFAULT NULL COMMENT 'อ้างอิงไปยัง order_items.id (อาจว่างเมื่อสร้างจาก FE ที่ยังไม่มี mapping)',
  `product_id` INT(11) NOT NULL COMMENT 'รหัสสินค้า',
  `promotion_id` INT(11) NULL DEFAULT NULL COMMENT 'ถ้ามาจากโปรโมชัน (อ้างอิง promotions.id)',
  `is_freebie` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'เป็นของแถมหรือไม่',
  `required_quantity` INT(11) NOT NULL COMMENT 'จำนวนที่ต้องตัดสต๊อก (ต่อสินค้า)',
  `allocated_quantity` INT(11) NOT NULL DEFAULT 0 COMMENT 'จำนวนที่จัดสรรแล้ว (รวมทุกคลัง/ล็อต)',
  `warehouse_id` INT(11) NULL DEFAULT NULL COMMENT 'คลังที่จัดสรร (ถ้ายังไม่เลือกปล่อยว่าง)',
  `lot_number` VARCHAR(128) NULL DEFAULT NULL COMMENT 'ล็อตที่จัดสรร (ถ้ายังไม่เลือกปล่อยว่าง)',
  `status` ENUM('PENDING','ALLOCATED','PICKED','SHIPPED','CANCELLED') NOT NULL DEFAULT 'PENDING' COMMENT 'สถานะการจัดสรร',
  `notes` TEXT NULL,
  `created_by` INT(11) NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_allocations_order` (`order_id`),
  KEY `idx_allocations_item` (`order_item_id`),
  KEY `idx_allocations_product` (`product_id`),
  KEY `idx_allocations_status` (`status`),
  CONSTRAINT `fk_allocations_order` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_allocations_item` FOREIGN KEY (`order_item_id`) REFERENCES `order_items`(`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_allocations_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_allocations_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_allocations_promotion` FOREIGN KEY (`promotion_id`) REFERENCES `promotions`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Helper view: รวมความต้องการตัดสต๊อกต่อออเดอร์ (แยกฟรี/ไม่ฟรี)
CREATE OR REPLACE VIEW `v_order_required_stock` AS
SELECT 
  a.order_id,
  a.product_id,
  SUM(a.required_quantity) AS required_qty,
  SUM(a.allocated_quantity) AS allocated_qty,
  SUM(CASE WHEN a.is_freebie=1 THEN a.required_quantity ELSE 0 END) AS free_qty,
  SUM(CASE WHEN a.is_freebie=0 THEN a.required_quantity ELSE 0 END) AS paid_qty
FROM order_item_allocations a
GROUP BY a.order_id, a.product_id;

