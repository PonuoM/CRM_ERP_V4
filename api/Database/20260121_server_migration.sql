-- ==========================================
-- Combined Migration Script for Server Deploy
-- Date: 2026-01-21
-- ==========================================
-- Contains: Schema changes only (no data)
-- - New columns in basket_config
-- - New table upsell_round_robin  
-- - New column in orders
-- ==========================================

-- ==========================================
-- 1. basket_config: Add ALL routing columns
-- ==========================================
ALTER TABLE `basket_config`
ADD COLUMN IF NOT EXISTS `on_sale_basket_key` VARCHAR(50) DEFAULT NULL COMMENT 'ถังที่ย้ายไปเมื่อขายได้',
ADD COLUMN IF NOT EXISTS `on_fail_basket_key` VARCHAR(50) DEFAULT NULL COMMENT 'ถังที่ย้ายไปเมื่อหมดเวลา/ไม่ขาย',
ADD COLUMN IF NOT EXISTS `fail_after_days` INT DEFAULT NULL COMMENT 'จำนวนวันก่อนถือว่าไม่ขาย',
ADD COLUMN IF NOT EXISTS `max_distribution_count` INT DEFAULT 4 COMMENT 'จำนวนรอบสูงสุดก่อนหลุดไปถังถัดไป',
ADD COLUMN IF NOT EXISTS `hold_days_before_redistribute` INT DEFAULT 30 COMMENT 'วันที่ต้องรอก่อนแจกซ้ำ',
ADD COLUMN IF NOT EXISTS `linked_basket_key` VARCHAR(50) DEFAULT NULL COMMENT 'ถังคู่ในอีก target_page',
ADD COLUMN IF NOT EXISTS `on_fail_reevaluate` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Re-evaluate on fail',
ADD COLUMN IF NOT EXISTS `on_max_dist_basket_key` VARCHAR(50) DEFAULT NULL COMMENT 'ถังปลายทางเมื่อครบวน',
ADD COLUMN IF NOT EXISTS `has_loop` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'มีวนซ้ำหรือไม่';

-- ==========================================
-- 4. Create upsell_round_robin table
-- ==========================================
CREATE TABLE IF NOT EXISTS `upsell_round_robin` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `company_id` INT NOT NULL DEFAULT 1,
    `last_assigned_user_id` INT DEFAULT NULL,
    `last_assigned_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `uk_company` (`company_id`)
) COMMENT='Track Round-Robin position for Upsell auto-assignment';

-- Initialize with NULL (will start from first telesale)
INSERT INTO `upsell_round_robin` (`company_id`, `last_assigned_user_id`) 
VALUES (1, NULL)
ON DUPLICATE KEY UPDATE `id` = `id`;

-- ==========================================
-- 5. orders: Add upsell_user_id column
-- ==========================================
ALTER TABLE `orders` 
ADD COLUMN IF NOT EXISTS `upsell_user_id` INT DEFAULT NULL 
COMMENT 'Telesale user assigned for Upsell via Round-Robin';

-- Add index for faster queries
ALTER TABLE `orders` ADD INDEX IF NOT EXISTS `idx_upsell_user` (`upsell_user_id`, `order_status`);

-- ==========================================
-- 6. customers: Add basket routing columns
-- ==========================================
ALTER TABLE `customers`
ADD COLUMN IF NOT EXISTS `distribution_count` INT DEFAULT 0 COMMENT 'จำนวนครั้งที่ถูกแจกแล้วไม่ขายได้',
ADD COLUMN IF NOT EXISTS `last_distribution_date` DATETIME DEFAULT NULL COMMENT 'วันที่แจกล่าสุด',
ADD COLUMN IF NOT EXISTS `hold_until_date` DATETIME DEFAULT NULL COMMENT 'ห้ามแจกจนกว่าถึงวันนี้',
ADD COLUMN IF NOT EXISTS `previous_assigned_to` JSON DEFAULT NULL COMMENT 'รายชื่อ user_id ที่เคยได้รับแจก',
ADD COLUMN IF NOT EXISTS `current_basket_key` VARCHAR(50) DEFAULT NULL COMMENT 'ถังปัจจุบัน',
ADD COLUMN IF NOT EXISTS `basket_entered_date` DATETIME DEFAULT NULL COMMENT 'วันที่เข้าถังปัจจุบัน';

-- Add indexes for customers
ALTER TABLE `customers`
ADD INDEX IF NOT EXISTS `idx_current_basket` (`current_basket_key`),
ADD INDEX IF NOT EXISTS `idx_hold_until` (`hold_until_date`),
ADD INDEX IF NOT EXISTS `idx_distribution_count` (`distribution_count`);

-- ==========================================
-- 7. Create basket_transition_log table
-- ==========================================
CREATE TABLE IF NOT EXISTS `basket_transition_log` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `customer_id` INT NOT NULL,
    `from_basket_key` VARCHAR(50) DEFAULT NULL COMMENT 'ถังต้นทาง',
    `to_basket_key` VARCHAR(50) NOT NULL COMMENT 'ถังปลายทาง',
    `transition_type` ENUM('sale', 'fail', 'monthly_cron', 'manual', 'redistribute') NOT NULL,
    `triggered_by` INT DEFAULT NULL COMMENT 'user_id ที่ทำให้เกิด',
    `notes` TEXT DEFAULT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_customer_id` (`customer_id`),
    INDEX `idx_transition_type` (`transition_type`),
    INDEX `idx_created_at` (`created_at`)
) COMMENT='Log การย้ายถังของลูกค้า';

-- ==========================================
-- Done! Schema migration complete.
-- ==========================================
