-- Migration: Add bank_account_id and transfer_date columns to orders table
-- Date: 2025-11-15

SET @dbname = DATABASE();
SET @tablename = 'orders';

-- Add bank_account_id column if it doesn't exist
SET @columnname = 'bank_account_id';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_schema = @dbname)
      AND (table_name = @tablename)
      AND (column_name = @columnname)
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' INT(11) NULL AFTER sales_channel_page_id, ADD INDEX `idx_orders_bank_account_id` (`', @columnname, '`), ADD CONSTRAINT `fk_orders_bank_account` FOREIGN KEY (`', @columnname, '`) REFERENCES `bank_account` (`id`) ON DELETE SET NULL')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add transfer_date column if it doesn't exist
SET @columnname = 'transfer_date';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_schema = @dbname)
      AND (table_name = @tablename)
      AND (column_name = @columnname)
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' DATETIME NULL AFTER bank_account_id')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Note: bank_account_id references bank_account table
-- transfer_date stores the date and time when the transfer was made

