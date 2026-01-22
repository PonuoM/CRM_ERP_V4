-- ==========================================
-- Combined Migration Script for Server Deploy
-- Date: 2026-01-21 (Fixed for MySQL 5.x compatibility)
-- ==========================================

-- ==========================================
-- 1. basket_config: Add ALL routing columns
-- ==========================================
-- Note: Run each separately. Skip if column already exists.

-- Check if columns exist before adding (MySQL compatible approach)
SET @dbname = DATABASE();
SET @tablename = 'basket_config';

-- on_sale_basket_key
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'on_sale_basket_key') > 0,
  'SELECT 1',
  "ALTER TABLE basket_config ADD COLUMN on_sale_basket_key VARCHAR(50) DEFAULT NULL"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- on_fail_basket_key
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'on_fail_basket_key') > 0,
  'SELECT 1',
  "ALTER TABLE basket_config ADD COLUMN on_fail_basket_key VARCHAR(50) DEFAULT NULL"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- fail_after_days
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'fail_after_days') > 0,
  'SELECT 1',
  "ALTER TABLE basket_config ADD COLUMN fail_after_days INT DEFAULT NULL"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- max_distribution_count
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'max_distribution_count') > 0,
  'SELECT 1',
  "ALTER TABLE basket_config ADD COLUMN max_distribution_count INT DEFAULT 4"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- hold_days_before_redistribute
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'hold_days_before_redistribute') > 0,
  'SELECT 1',
  "ALTER TABLE basket_config ADD COLUMN hold_days_before_redistribute INT DEFAULT 30"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- linked_basket_key
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'linked_basket_key') > 0,
  'SELECT 1',
  "ALTER TABLE basket_config ADD COLUMN linked_basket_key VARCHAR(50) DEFAULT NULL"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- on_fail_reevaluate
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'on_fail_reevaluate') > 0,
  'SELECT 1',
  "ALTER TABLE basket_config ADD COLUMN on_fail_reevaluate TINYINT(1) NOT NULL DEFAULT 0"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- on_max_dist_basket_key
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'on_max_dist_basket_key') > 0,
  'SELECT 1',
  "ALTER TABLE basket_config ADD COLUMN on_max_dist_basket_key VARCHAR(50) DEFAULT NULL"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- has_loop
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'has_loop') > 0,
  'SELECT 1',
  "ALTER TABLE basket_config ADD COLUMN has_loop TINYINT(1) NOT NULL DEFAULT 0"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- ==========================================
-- 2. Create upsell_round_robin table
-- ==========================================
CREATE TABLE IF NOT EXISTS `upsell_round_robin` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `company_id` INT NOT NULL DEFAULT 1,
    `last_assigned_user_id` INT DEFAULT NULL,
    `last_assigned_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `uk_company` (`company_id`)
);

INSERT INTO `upsell_round_robin` (`company_id`, `last_assigned_user_id`) 
VALUES (1, NULL)
ON DUPLICATE KEY UPDATE `id` = `id`;

-- ==========================================
-- 3. orders: Add upsell_user_id column
-- ==========================================
SET @tablename = 'orders';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'upsell_user_id') > 0,
  'SELECT 1',
  "ALTER TABLE orders ADD COLUMN upsell_user_id INT DEFAULT NULL"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- ==========================================
-- 4. customers: Add basket routing columns
-- ==========================================
SET @tablename = 'customers';

-- distribution_count
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'distribution_count') > 0,
  'SELECT 1',
  "ALTER TABLE customers ADD COLUMN distribution_count INT DEFAULT 0"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- last_distribution_date
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'last_distribution_date') > 0,
  'SELECT 1',
  "ALTER TABLE customers ADD COLUMN last_distribution_date DATETIME DEFAULT NULL"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- hold_until_date
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'hold_until_date') > 0,
  'SELECT 1',
  "ALTER TABLE customers ADD COLUMN hold_until_date DATETIME DEFAULT NULL"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- previous_assigned_to
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'previous_assigned_to') > 0,
  'SELECT 1',
  "ALTER TABLE customers ADD COLUMN previous_assigned_to JSON DEFAULT NULL"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- current_basket_key
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'current_basket_key') > 0,
  'SELECT 1',
  "ALTER TABLE customers ADD COLUMN current_basket_key VARCHAR(50) DEFAULT NULL"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- basket_entered_date
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'basket_entered_date') > 0,
  'SELECT 1',
  "ALTER TABLE customers ADD COLUMN basket_entered_date DATETIME DEFAULT NULL"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- ==========================================
-- 5. Create basket_transition_log table
-- ==========================================
CREATE TABLE IF NOT EXISTS `basket_transition_log` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `customer_id` INT NOT NULL,
    `from_basket_key` VARCHAR(50) DEFAULT NULL,
    `to_basket_key` VARCHAR(50) NOT NULL,
    `transition_type` ENUM('sale', 'fail', 'monthly_cron', 'manual', 'redistribute') NOT NULL,
    `triggered_by` INT DEFAULT NULL,
    `notes` TEXT DEFAULT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_customer_id` (`customer_id`),
    INDEX `idx_transition_type` (`transition_type`),
    INDEX `idx_created_at` (`created_at`)
);

-- ==========================================
-- Done!
-- ==========================================
SELECT 'Migration completed successfully!' as status;
