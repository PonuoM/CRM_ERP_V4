-- Migration: Create basket_config table for configurable basket rules
-- Date: 2026-01-16
-- Purpose: Store configurable rules for basket categorization (Dashboard V2 + Distribution Page)

CREATE TABLE IF NOT EXISTS `basket_config` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `basket_key` VARCHAR(50) NOT NULL,
    `basket_name` VARCHAR(100) NOT NULL,
    `min_order_count` INT DEFAULT NULL COMMENT 'Minimum order count (NULL = no limit)',
    `max_order_count` INT DEFAULT NULL COMMENT 'Maximum order count (NULL = no limit)',
    `min_days_since_order` INT DEFAULT NULL COMMENT 'Minimum days since last order',
    `max_days_since_order` INT DEFAULT NULL COMMENT 'Maximum days since last order',
    `days_since_first_order` INT DEFAULT NULL COMMENT 'For new customer basket',
    `days_since_registered` INT DEFAULT NULL COMMENT 'For new customer without orders',
    `target_page` ENUM('dashboard_v2', 'distribution') NOT NULL DEFAULT 'dashboard_v2',
    `display_order` INT DEFAULT 0,
    `is_active` BOOLEAN DEFAULT TRUE,
    `company_id` INT NOT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `uk_basket_company` (`basket_key`, `company_id`),
    INDEX `idx_company_page` (`company_id`, `target_page`),
    INDEX `idx_display_order` (`display_order`)
);

-- Default basket configurations for Dashboard V2
INSERT INTO `basket_config` (`basket_key`, `basket_name`, `min_order_count`, `max_order_count`, `min_days_since_order`, `max_days_since_order`, `days_since_first_order`, `days_since_registered`, `target_page`, `display_order`, `company_id`) VALUES
-- Dashboard V2 Baskets
('upsell', 'Upsell', NULL, NULL, NULL, 0, NULL, NULL, 'dashboard_v2', 1, 1),
('new_customer', 'ลูกค้าใหม่', 0, 1, NULL, 30, 30, 30, 'dashboard_v2', 2, 1),
('month_1_2', '1-2 เดือน', 2, NULL, NULL, 60, NULL, NULL, 'dashboard_v2', 3, 1),
('month_3', 'โอกาสสุดท้าย เดือน 3', 2, NULL, 61, 90, NULL, NULL, 'dashboard_v2', 4, 1),
-- Distribution Page Baskets
('find_new_caretaker', 'หาคนดูแลใหม่', 2, NULL, 91, 180, NULL, NULL, 'distribution', 1, 1),
('waiting_to_woo', 'รอคนมาจีบให้ติด', 1, 1, 31, 180, NULL, NULL, 'distribution', 2, 1),
('mid_basket_6_12', 'ถังกลาง 6-12 เดือน', NULL, NULL, 181, 365, NULL, NULL, 'distribution', 3, 1),
('mid_basket_1_3_years', 'ถังกลาง 1-3 ปี', NULL, NULL, 366, 1095, NULL, NULL, 'distribution', 4, 1),
('ancient', 'ถังโบราณ เก่าเก็บ', NULL, NULL, 1096, NULL, NULL, NULL, 'distribution', 5, 1);
