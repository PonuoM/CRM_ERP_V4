-- Migration 010: Create customer_grades_settings table

CREATE TABLE IF NOT EXISTS `customer_grades_settings` (
    `company_id` INT PRIMARY KEY,
    `calc_mode` ENUM('all', 'order_date', 'delivery_date') NOT NULL DEFAULT 'all',
    `time_range_type` ENUM('fixed', 'relative') NOT NULL DEFAULT 'fixed',
    `fixed_start_date` DATE NULL,
    `fixed_end_date` DATE NULL,
    `relative_days` INT NOT NULL DEFAULT 365,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Add default settings for company_id = 1
INSERT IGNORE INTO `customer_grades_settings` (`company_id`, `calc_mode`, `time_range_type`) VALUES (1, 'all', 'fixed');
