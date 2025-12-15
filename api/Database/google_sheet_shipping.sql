-- Migration: Create google_sheet_shipping table
-- Date: 2025-12-13
-- Description: Table to store shipping data imported from Google Sheet

CREATE TABLE IF NOT EXISTS `google_sheet_shipping` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `system_created_time` DATETIME NOT NULL COMMENT 'เวลาที่ระบบสร้างขึ้น (จาก Google Sheet)',
  `order_number` VARCHAR(128) NOT NULL COMMENT 'หมายเลขคำสั่งซื้อ',
  `delivery_date` DATE NULL COMMENT 'วันที่จัดส่ง',
  `delivery_status` VARCHAR(100) NULL COMMENT 'สถานะจัดส่ง',
  `imported_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'เวลาที่นำเข้าข้อมูล',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'เวลาที่อัพเดทข้อมูล',
  INDEX `idx_order_time` (`order_number`, `system_created_time`),
  INDEX `idx_order_number` (`order_number`),
  INDEX `idx_delivery_date` (`delivery_date`),
  INDEX `idx_delivery_status` (`delivery_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='ข้อมูลการจัดส่งจาก Google Sheet ของบริษัทขนส่ง';

SELECT 'Migration google_sheet_shipping.sql completed' AS message;
