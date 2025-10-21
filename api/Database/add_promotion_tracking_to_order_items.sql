-- Migration: Add promotion tracking fields to order_items table
-- Created: 2025-01-16
-- Purpose: Support promotion expansion in order items for better sales reporting

-- Add new columns to order_items table
ALTER TABLE `order_items` 
ADD COLUMN `promotion_id` INT(11) NULL DEFAULT NULL COMMENT 'รหัสโปรโมชั่นที่รายการนี้มาจาก',
ADD COLUMN `parent_item_id` INT(11) NULL DEFAULT NULL COMMENT 'รหัสรายการแม่ (สำหรับรายการย่อยของโปรโมชั่น)',
ADD COLUMN `is_promotion_parent` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'เป็นรายการแม่ของโปรโมชั่นหรือไม่';

-- Add indexes for better performance
ALTER TABLE `order_items`
ADD INDEX `idx_order_items_promotion` (`promotion_id`),
ADD INDEX `idx_order_items_parent` (`parent_item_id`),
ADD INDEX `idx_order_items_promotion_parent` (`is_promotion_parent`);

-- Add foreign key constraints
ALTER TABLE `order_items`
ADD CONSTRAINT `fk_order_items_promotion` FOREIGN KEY (`promotion_id`) REFERENCES `promotions` (`id`) ON DELETE SET NULL,
ADD CONSTRAINT `fk_order_items_parent` FOREIGN KEY (`parent_item_id`) REFERENCES `order_items` (`id`) ON DELETE CASCADE;

-- Add comments to existing columns for clarity
ALTER TABLE `order_items` 
MODIFY COLUMN `product_id` INT(11) NULL DEFAULT NULL COMMENT 'รหัสสินค้า (NULL สำหรับรายการโปรโมชั่น)',
MODIFY COLUMN `product_name` VARCHAR(255) NULL DEFAULT NULL COMMENT 'ชื่อสินค้า (หรือชื่อโปรโมชั่นสำหรับ parent item)',
MODIFY COLUMN `quantity` INT(11) NOT NULL COMMENT 'จำนวน (สำหรับ parent = จำนวนเซ็ต, สำหรับ child = จำนวนชิ้น)',
MODIFY COLUMN `is_freebie` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'เป็นของแถมหรือไม่ (ใช้กับ child items)';
