-- Migration: Update basket_transition_log for Event-Driven Basket Routing V2
-- Date: 2026-02-05
-- Purpose: Add assigned_to tracking and order reference

-- Select the database
USE `primacom_mini_erp`;

-- =====================================================
-- Part 1: Add new columns
-- =====================================================

ALTER TABLE `basket_transition_log`
ADD COLUMN IF NOT EXISTS `assigned_to_old` INT DEFAULT NULL COMMENT 'Owner ก่อนย้าย' AFTER `to_basket_key`,
ADD COLUMN IF NOT EXISTS `assigned_to_new` INT DEFAULT NULL COMMENT 'Owner หลังย้าย' AFTER `assigned_to_old`,
ADD COLUMN IF NOT EXISTS `order_id` VARCHAR(50) DEFAULT NULL COMMENT 'Order ที่ trigger การย้าย' AFTER `triggered_by`;

-- =====================================================
-- Part 2: Update transition_type ENUM
-- =====================================================

ALTER TABLE `basket_transition_log`
MODIFY COLUMN `transition_type` ENUM(
    -- Original types
    'sale', 'fail', 'monthly_cron', 'manual', 'redistribute',
    -- New Pending triggers
    'pending_admin_owned',      -- A2: Admin สร้าง + มี owner → 51
    'pending_admin_unowned',    -- A1: Admin สร้าง + ไม่มี owner → 53
    -- New Picking triggers
    'picking_upsell_sold',      -- P1: ถัง 51 + Telesale ขาย → 39
    'picking_upsell_not_sold',  -- P2: ถัง 51 + ไม่มี Telesale → 38
    'picking_dist_to_pool',     -- P3: ถัง 53 + Picking ก่อนแจก → 52
    'picking_telesale_own',     -- P4: มี owner + Telesale ขาย → 39
    'picking_admin_to_upsell',  -- P5: มี owner + Admin ขาย → 51
    'picking_telesale_from_dist', -- P6: ไม่มี owner + Telesale ขาย → 39 + assign
    'picking_admin_no_owner',   -- P7: ไม่มี owner + Admin ขาย → 52
    -- Aging
    'aging_timeout',            -- Cron: อยู่นานเกิน fail_after_days
    -- Upsell flow types
    'upsell_by_others',
    'upsell_exit',
    'upsell_distribution'
) NOT NULL COMMENT 'ประเภทการย้าย';

-- =====================================================
-- Part 3: Add index for order tracking
-- =====================================================

CREATE INDEX IF NOT EXISTS `idx_order_id` ON `basket_transition_log` (`order_id`);
CREATE INDEX IF NOT EXISTS `idx_assigned_old` ON `basket_transition_log` (`assigned_to_old`);
CREATE INDEX IF NOT EXISTS `idx_assigned_new` ON `basket_transition_log` (`assigned_to_new`);

-- =====================================================
-- Part 4: Backup existing data (informational)
-- =====================================================

-- To backup before running this migration:
-- mysqldump -u [user] -p [database] basket_transition_log > basket_transition_log_backup_20260205.sql
