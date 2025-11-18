-- Migration: Add Finance role and new status enums
-- Date: 2025-11-15

SET @dbname = DATABASE();

-- Add new payment_status enum values
SET @tablename = 'orders';
SET @columnname = 'payment_status';

-- Check current enum values and add new ones if needed
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_schema = @dbname)
      AND (table_name = @tablename)
      AND (column_name = @columnname)
      AND (column_type LIKE '%PreApproved%' OR column_type LIKE '%Approved%')
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' MODIFY COLUMN ', @columnname, ' ENUM(\'Unpaid\',\'PendingVerification\',\'Verified\',\'PreApproved\',\'Approved\',\'Paid\') NULL')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add new order_status enum values
SET @columnname = 'order_status';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_schema = @dbname)
      AND (table_name = @tablename)
      AND (column_name = @columnname)
      AND (column_type LIKE '%AwaitingVerification%' OR column_type LIKE '%Preparing%' OR column_type LIKE '%PreApproved%')
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' MODIFY COLUMN ', @columnname, ' ENUM(\'Pending\',\'AwaitingVerification\',\'Confirmed\',\'Preparing\',\'Picking\',\'Shipping\',\'PreApproved\',\'Delivered\',\'Returned\',\'Cancelled\') NULL')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Note: Finance role should be added to users table role enum if it uses ENUM
-- For now, assuming role is stored as VARCHAR, so no migration needed for role

