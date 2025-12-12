-- Commission System Database Migration (REVISED)
-- Created: 2025-12-12
-- Updated: Uses statement_reconcile_logs confirmation instead of order approval
-- Purpose: Add commission calculation system

-- NO CHANGES TO ORDERS TABLE (uses existing reconcile confirmation)

-- 1. Create commission_periods table
CREATE TABLE IF NOT EXISTS `commission_periods` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `company_id` INT NOT NULL COMMENT 'บริษัท',
  `period_month` INT NOT NULL COMMENT 'เดือนที่คำนวณ (1-12)',
  `period_year` INT NOT NULL COMMENT 'ปีที่คำนวณ',
  `order_month` INT NOT NULL COMMENT 'เดือนของออเดอร์ที่นำมาคิด (1-12)',
  `order_year` INT NOT NULL COMMENT 'ปีของออเดอร์ที่นำมาคิด',
  `cutoff_date` DATE NOT NULL COMMENT 'วันตัดรอบ (เช่น 2024-12-20)',
  `status` VARCHAR(20) DEFAULT 'Draft' COMMENT 'Draft, Calculated, Approved, Paid',
  `total_sales` DECIMAL(14,2) DEFAULT 0.00 COMMENT 'ยอดขายรวมทั้งหมด',
  `total_commission` DECIMAL(14,2) DEFAULT 0.00 COMMENT 'ค่าคอมรวมทั้งหมด',
  `total_orders` INT DEFAULT 0 COMMENT 'จำนวนออเดอร์ทั้งหมด',
  `calculated_at` DATETIME NULL COMMENT 'วันที่คำนวณ',
  `calculated_by` INT NULL COMMENT 'ผู้คำนวณ',
  `approved_at` DATETIME NULL COMMENT 'วันที่อนุมัติ',
  `approved_by` INT NULL COMMENT 'ผู้อนุมัติ',
  `paid_at` DATETIME NULL COMMENT 'วันที่จ่ายเงิน',
  `notes` TEXT NULL COMMENT 'หมายเหตุ',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `unique_period` (`company_id`, `period_year`, `period_month`),
  INDEX `idx_period_status` (`status`),
  INDEX `idx_period_company` (`company_id`, `period_year`, `period_month`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='รอบการคำนวณค่าคอมมิชชัน';

-- 2. Create commission_records table
CREATE TABLE IF NOT EXISTS `commission_records` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `period_id` INT NOT NULL COMMENT 'รอบการคำนวณ',
  `user_id` INT NOT NULL COMMENT 'Sales person',
  `total_sales` DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT 'ยอดขายรวม',
  `commission_rate` DECIMAL(5,2) NULL COMMENT '% ค่าคอม',
  `commission_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT 'จำนวนเงินค่าคอม',
  `order_count` INT DEFAULT 0 COMMENT 'จำนวนออเดอร์',
  `notes` TEXT NULL COMMENT 'หมายเหตุ',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`period_id`) REFERENCES `commission_periods`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`),
  INDEX `idx_commission_period_user` (`period_id`, `user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='บันทึกค่าคอมมิชชันของแต่ละคน';

-- 3. Create commission_order_lines table
CREATE TABLE IF NOT EXISTS `commission_order_lines` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `record_id` INT NOT NULL COMMENT 'รหัสบันทึกค่าคอม',
  `order_id` VARCHAR(32) NOT NULL COMMENT 'รหัสออเดอร์',
  `order_date` DATE NOT NULL COMMENT 'วันที่สร้างออเดอร์',
  `confirmed_at` DATETIME NOT NULL COMMENT 'วันที่ยืนยันจาก reconcile',
  `order_amount` DECIMAL(12,2) NOT NULL COMMENT 'ยอดออเดอร์',
  `commission_amount` DECIMAL(12,2) NOT NULL COMMENT 'ค่าคอมของออเดอร์นี้',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`record_id`) REFERENCES `commission_records`(`id`) ON DELETE CASCADE,
  INDEX `idx_commission_order` (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='รายละเอียดออเดอร์ที่นำมาคิดค่าคอม';

-- Success message
SELECT 'Commission system tables created successfully! (Using reconcile confirmation)' AS status;
