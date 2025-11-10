-- Migration: 20251110_create_bank_account_and_update_order_slips.sql
-- Description: Create bank_account table and add columns to order_slips table

-- Create bank_account table
CREATE TABLE IF NOT EXISTS `bank_account` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `company_id` INT NOT NULL,
  `bank` VARCHAR(100) NOT NULL,
  `bank_number` VARCHAR(50) NOT NULL,
  `is_active` BOOLEAN DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME NULL,

  INDEX `idx_company_id` (`company_id`),
  INDEX `idx_is_active` (`is_active`),
  CONSTRAINT `fk_bank_account_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Check if order_slips table exists
SET @table_exists = (SELECT COUNT(*) FROM information_schema.tables
                   WHERE table_schema = DATABASE() AND table_name = 'order_slips');

-- Check if columns exist
SET @amount_exists = (SELECT COUNT(*) FROM information_schema.columns
                      WHERE table_schema = DATABASE()
                      AND table_name = 'order_slips'
                      AND column_name = 'amount');

SET @bank_account_id_exists = (SELECT COUNT(*) FROM information_schema.columns
                               WHERE table_schema = DATABASE()
                               AND table_name = 'order_slips'
                               AND column_name = 'bank_account_id');

SET @created_at_exists = (SELECT COUNT(*) FROM information_schema.columns
                          WHERE table_schema = DATABASE()
                          AND table_name = 'order_slips'
                          AND column_name = 'created_at');

SET @updated_at_exists = (SELECT COUNT(*) FROM information_schema.columns
                          WHERE table_schema = DATABASE()
                          AND table_name = 'order_slips'
                          AND column_name = 'updated_at');

-- Add amount column if not exists
SET @sql = IF(@table_exists > 0 AND @amount_exists = 0,
  'ALTER TABLE `order_slips` ADD COLUMN `amount` INT NULL AFTER `id`',
  'SELECT "Skipping amount column - already exists or table does not exist" as message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add bank_account_id column if not exists
SET @sql = IF(@table_exists > 0 AND @bank_account_id_exists = 0,
  'ALTER TABLE `order_slips` ADD COLUMN `bank_account_id` INT NULL AFTER `amount`',
  'SELECT "Skipping bank_account_id column - already exists or table does not exist" as message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add created_at column if not exists
SET @sql = IF(@table_exists > 0 AND @created_at_exists = 0,
  'ALTER TABLE `order_slips` ADD COLUMN `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER `bank_account_id`',
  'SELECT "Skipping created_at column - already exists or table does not exist" as message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add updated_at column if not exists
SET @sql = IF(@table_exists > 0 AND @updated_at_exists = 0,
  'ALTER TABLE `order_slips` ADD COLUMN `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER `created_at`',
  'SELECT "Skipping updated_at column - already exists or table does not exist" as message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add index for bank_account_id if table exists and index doesn't exist
SET @index_exists = (SELECT COUNT(*) FROM information_schema.statistics
                     WHERE table_schema = DATABASE()
                     AND table_name = 'order_slips'
                     AND index_name = 'idx_order_slips_bank_account_id');

SET @sql = IF(@table_exists > 0 AND @bank_account_id_exists > 0 AND @index_exists = 0,
  'ALTER TABLE `order_slips` ADD INDEX `idx_order_slips_bank_account_id` (`bank_account_id`)',
  'SELECT "Skipping bank_account_id index - already exists or column does not exist" as message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add foreign key constraint if table exists and foreign key doesn't exist
SET @fk_exists = (SELECT COUNT(*) FROM information_schema.table_constraints
                  WHERE table_schema = DATABASE()
                  AND table_name = 'order_slips'
                  AND constraint_name = 'fk_order_slips_bank_account_id');

SET @sql = IF(@table_exists > 0 AND @bank_account_id_exists > 0 AND @fk_exists = 0,
  'ALTER TABLE `order_slips` ADD CONSTRAINT `fk_order_slips_bank_account_id` FOREIGN KEY (`bank_account_id`) REFERENCES `bank_account` (`id`) ON DELETE SET NULL',
  'SELECT "Skipping foreign key constraint - already exists or column does not exist" as message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Migration completed
SELECT 'Migration 20251110_create_bank_account_and_update_order_slips.sql completed successfully' as message;

-- Show summary of changes
SELECT
  'bank_account' as table_name,
  COUNT(*) as record_count,
  'Created with is_active column' as status
FROM bank_account

UNION ALL

SELECT
  'order_slips' as table_name,
  COUNT(*) as record_count,
  CASE
    WHEN @amount_exists = 0 OR @bank_account_id_exists = 0 OR @created_at_exists = 0 OR @updated_at_exists = 0
    THEN 'Columns added'
    ELSE 'Columns already existed'
  END as status
FROM order_slips;
