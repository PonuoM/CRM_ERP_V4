-- Migration 009: Create customer_grades_config table and modify customers.grade to VARCHAR

-- 1. Create the new customer_grades_config table
CREATE TABLE IF NOT EXISTS `customer_grades_config` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `company_id` INT NOT NULL,
    `grade_name` VARCHAR(50) NOT NULL,
    `min_order_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    `color_theme` VARCHAR(50) NOT NULL DEFAULT 'bg-gray-100 text-gray-800',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `idx_company_grade` (`company_id`, `grade_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Modify existing 'grade' column in 'customers' table to VARCHAR to support dynamic names
-- Prevents ENUM strict errors when saving new dynamic grades like 'VIP' or 'S+'
ALTER TABLE `customers` MODIFY COLUMN `grade` VARCHAR(50) NOT NULL DEFAULT 'D';

-- 3. Seed default data for existing company_id = 1 (Baseline configuration)
INSERT IGNORE INTO `customer_grades_config` (`company_id`, `grade_name`, `min_order_amount`, `color_theme`) VALUES
(1, 'A+', 100000.00, 'bg-purple-100 text-purple-800'),
(1, 'A', 80000.00, 'bg-green-100 text-green-800'),
(1, 'B', 50000.00, 'bg-blue-100 text-blue-800'),
(1, 'C', 30000.00, 'bg-yellow-100 text-yellow-800'),
(1, 'D', 0.00, 'bg-gray-100 text-gray-800');
