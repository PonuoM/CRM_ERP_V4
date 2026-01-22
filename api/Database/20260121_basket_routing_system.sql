-- Migration: Basket Routing System - Database Schema Changes
-- Date: 2026-01-21
-- Purpose: Add fields for basket transition rules, distribution tracking, and hold periods

-- ============================================
-- Part 1: Add new fields to basket_config table
-- ============================================

ALTER TABLE `basket_config`
ADD COLUMN `on_sale_basket_key` VARCHAR(50) DEFAULT NULL COMMENT 'ถังที่ย้ายไปเมื่อขายได้ (เช่น month_1_2)',
ADD COLUMN `on_fail_basket_key` VARCHAR(50) DEFAULT NULL COMMENT 'ถังที่ย้ายไปเมื่อหมดเวลา/ไม่ขาย',
ADD COLUMN `fail_after_days` INT DEFAULT NULL COMMENT 'จำนวนวันก่อนถือว่า "ไม่ขาย" แล้วย้ายถัง',
ADD COLUMN `max_distribution_count` INT DEFAULT 4 COMMENT 'จำนวนรอบสูงสุดก่อนหลุดไปถังถัดไป',
ADD COLUMN `hold_days_before_redistribute` INT DEFAULT 30 COMMENT 'วันที่ต้องรอก่อนแจกซ้ำ',
ADD COLUMN `linked_basket_key` VARCHAR(50) DEFAULT NULL COMMENT 'ถังคู่ (ชื่อเดียวกันในอีก target_page)';

-- ============================================
-- Part 2: Add new fields to customers table
-- ============================================

ALTER TABLE `customers`
ADD COLUMN `distribution_count` INT DEFAULT 0 COMMENT 'จำนวนครั้งที่ถูกแจกแล้วไม่ขายได้',
ADD COLUMN `last_distribution_date` DATETIME DEFAULT NULL COMMENT 'วันที่แจกล่าสุด',
ADD COLUMN `hold_until_date` DATETIME DEFAULT NULL COMMENT 'ห้ามแจกจนกว่าถึงวันนี้ (Hold Period)',
ADD COLUMN `previous_assigned_to` JSON DEFAULT NULL COMMENT 'รายชื่อ user_id ที่เคยได้รับแจก (ห้ามซ้ำ)',
ADD COLUMN `current_basket_key` VARCHAR(50) DEFAULT NULL COMMENT 'ถังปัจจุบัน (สำหรับ tracking)',
ADD COLUMN `basket_entered_date` DATETIME DEFAULT NULL COMMENT 'วันที่เข้าถังปัจจุบัน';

-- Add index for performance
ALTER TABLE `customers`
ADD INDEX `idx_current_basket` (`current_basket_key`),
ADD INDEX `idx_hold_until` (`hold_until_date`),
ADD INDEX `idx_distribution_count` (`distribution_count`);

-- ============================================
-- Part 3: Create basket_transition_log table
-- ============================================

CREATE TABLE IF NOT EXISTS `basket_transition_log` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `customer_id` INT NOT NULL,
    `from_basket_key` VARCHAR(50) DEFAULT NULL COMMENT 'ถังต้นทาง (NULL = ไม่มีถัง)',
    `to_basket_key` VARCHAR(50) NOT NULL COMMENT 'ถังปลายทาง',
    `transition_type` ENUM('sale', 'fail', 'monthly_cron', 'manual', 'redistribute') NOT NULL COMMENT 'ประเภทการย้าย',
    `triggered_by` INT DEFAULT NULL COMMENT 'user_id ที่ทำให้เกิด (ถ้ามี)',
    `notes` TEXT DEFAULT NULL COMMENT 'หมายเหตุเพิ่มเติม',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_customer_id` (`customer_id`),
    INDEX `idx_transition_type` (`transition_type`),
    INDEX `idx_created_at` (`created_at`)
);

-- ============================================
-- Part 4: Update default basket transition rules
-- ============================================

-- Dashboard V2 Baskets: ขายได้ -> 1-2 เดือน
UPDATE `basket_config` SET
    `on_sale_basket_key` = 'month_1_2',
    `fail_after_days` = 30,
    `on_fail_basket_key` = 'waiting_to_woo',
    `max_distribution_count` = 4,
    `hold_days_before_redistribute` = 30
WHERE `basket_key` = 'new_customer' AND `target_page` = 'dashboard_v2';

UPDATE `basket_config` SET
    `on_sale_basket_key` = 'month_1_2',
    `fail_after_days` = 60,
    `on_fail_basket_key` = 'month_3'
WHERE `basket_key` = 'month_1_2' AND `target_page` = 'dashboard_v2';

UPDATE `basket_config` SET
    `on_sale_basket_key` = 'month_1_2',
    `fail_after_days` = 90,
    `on_fail_basket_key` = 'find_new_caretaker'
WHERE `basket_key` = 'month_3' AND `target_page` = 'dashboard_v2';

-- Distribution Baskets: รอคนมาจีบให้ติด
UPDATE `basket_config` SET
    `on_sale_basket_key` = 'month_1_2',
    `fail_after_days` = 30,
    `on_fail_basket_key` = 'waiting_to_woo',
    `max_distribution_count` = 4,
    `hold_days_before_redistribute` = 0,
    `linked_basket_key` = 'waiting_to_woo_dashboard'
WHERE `basket_key` = 'waiting_to_woo' AND `target_page` = 'distribution';

-- หาคนดูแลใหม่
UPDATE `basket_config` SET
    `on_sale_basket_key` = 'month_1_2',
    `fail_after_days` = 30,
    `on_fail_basket_key` = 'find_new_caretaker',
    `max_distribution_count` = 4,
    `hold_days_before_redistribute` = 30,
    `linked_basket_key` = 'find_new_caretaker_dashboard'
WHERE `basket_key` = 'find_new_caretaker' AND `target_page` = 'distribution';

-- ถังกลาง: ไม่มี on_fail เพราะจะอยู่ถาวรหรือย้ายตามเงื่อนไขวัน
UPDATE `basket_config` SET
    `on_sale_basket_key` = 'month_1_2'
WHERE `basket_key` IN ('mid_basket_6_12', 'mid_basket_1_3_years', 'ancient') AND `target_page` = 'distribution';

-- ============================================
-- Part 5: Add linked baskets in Dashboard V2 (for รอคนมาจีบ และ หาคนดูแลใหม่)
-- ============================================

INSERT IGNORE INTO `basket_config` 
(`basket_key`, `basket_name`, `min_order_count`, `max_order_count`, `min_days_since_order`, `max_days_since_order`, `target_page`, `display_order`, `company_id`, `on_sale_basket_key`, `fail_after_days`, `on_fail_basket_key`, `linked_basket_key`) 
VALUES
-- Dashboard V2 linked baskets (appear when assigned from distribution)
('waiting_to_woo_dashboard', 'รอคนมาจีบให้ติด', 1, 1, 0, 30, 'dashboard_v2', 5, 1, 'month_1_2', 30, 'waiting_to_woo', 'waiting_to_woo'),
('find_new_caretaker_dashboard', 'หาคนดูแลใหม่', 2, NULL, 0, 30, 'dashboard_v2', 6, 1, 'month_1_2', 30, 'find_new_caretaker', 'find_new_caretaker');

-- ============================================
-- Verification Query (run after migration)
-- ============================================
-- SELECT basket_key, basket_name, target_page, on_sale_basket_key, on_fail_basket_key, fail_after_days, max_distribution_count, hold_days_before_redistribute, linked_basket_key FROM basket_config ORDER BY target_page, display_order;
