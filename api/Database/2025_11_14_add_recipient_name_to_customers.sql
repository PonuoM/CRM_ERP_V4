-- Add recipient_first_name and recipient_last_name columns to customers table
-- These fields store the recipient name for the primary address (profile address)
-- For additional addresses, recipient names are stored in customer_address table

-- Check if columns exist before adding them
SET @dbname = DATABASE();
SET @tablename = 'customers';
SET @columnname = 'recipient_first_name';

-- Add recipient_first_name column if it doesn't exist
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_schema = @dbname)
      AND (table_name = @tablename)
      AND (column_name = @columnname)
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN `', @columnname, '` VARCHAR(128) NULL AFTER `postal_code`')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add recipient_last_name column if it doesn't exist
SET @columnname = 'recipient_last_name';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_schema = @dbname)
      AND (table_name = @tablename)
      AND (column_name = @columnname)
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN `', @columnname, '` VARCHAR(128) NULL AFTER `recipient_first_name`')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Auto-populate existing records: set recipient name = customer name
-- This ensures all existing customers have recipient names matching their own names
UPDATE customers
SET 
  recipient_first_name = first_name,
  recipient_last_name = last_name
WHERE 
  recipient_first_name IS NULL 
  OR recipient_first_name = ''
  OR recipient_last_name IS NULL
  OR recipient_last_name = '';

-- Note: 
-- - Primary address (profile address) uses recipient_first_name and recipient_last_name from customers table
-- - Additional addresses use recipient_first_name and recipient_last_name from customer_address table
-- - These fields allow specifying a different recipient name than the customer's name

