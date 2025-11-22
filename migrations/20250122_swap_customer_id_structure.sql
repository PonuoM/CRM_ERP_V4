-- Migration: Swap customer_id and customer_ref_id structure
-- Date: 2025-01-22
-- Description: 
--   - customer_id: Change from VARCHAR(64) to INT(11) AUTO_INCREMENT PRIMARY KEY (for unique sequential numbering)
--   - customer_ref_id: Change from INT(11) PRIMARY KEY to VARCHAR(64) (for CUS-phone-company format, updates based on phone field)
--
-- IMPORTANT: Backup your database before running this migration!

START TRANSACTION;

-- Step 1: Drop all foreign key constraints that reference customers table
-- MySQL doesn't support IF EXISTS for DROP FOREIGN KEY, so we check first

SET @sql := IF(
  EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_activity_customer'
  ),
  'ALTER TABLE `activities` DROP FOREIGN KEY `fk_activity_customer`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_appt_customer'
  ),
  'ALTER TABLE `appointments` DROP FOREIGN KEY `fk_appt_customer`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_call_customer'
  ),
  'ALTER TABLE `call_history` DROP FOREIGN KEY `fk_call_customer`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_cah_customer'
  ),
  'ALTER TABLE `customer_assignment_history` DROP FOREIGN KEY `fk_cah_customer`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_customer_tags_customer'
  ),
  'ALTER TABLE `customer_tags` DROP FOREIGN KEY `fk_customer_tags_customer`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_orders_customer'
  ),
  'ALTER TABLE `orders` DROP FOREIGN KEY `fk_orders_customer`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_customer_logs_customer'
  ),
  'ALTER TABLE `customer_logs` DROP FOREIGN KEY `fk_customer_logs_customer`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Step 2: Drop triggers that might interfere
DROP TRIGGER IF EXISTS `customers_before_insert`;
DROP TRIGGER IF EXISTS `customers_before_update`;
DROP TRIGGER IF EXISTS `orders_customer_ref_bu`;
DROP TRIGGER IF EXISTS `customer_after_insert`;
DROP TRIGGER IF EXISTS `customer_after_update`;
DROP TRIGGER IF EXISTS `customer_before_delete`;
DROP TRIGGER IF EXISTS `trg_validate_customer_assignment`;

-- Step 3: Drop indexes and primary key (only if they exist)
SET @has_primary_key := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'customers'
    AND CONSTRAINT_TYPE = 'PRIMARY KEY'
);
SET @sql := IF(@has_primary_key > 0,
  'ALTER TABLE `customers` DROP PRIMARY KEY',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND INDEX_NAME = 'idx_customer_id'
);
SET @sql := IF(@idx_exists > 0,
  'ALTER TABLE `customers` DROP INDEX `idx_customer_id`',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND INDEX_NAME = 'uniq_customers_customer_id'
);
SET @sql := IF(@idx_exists > 0,
  'ALTER TABLE `customers` DROP INDEX `uniq_customers_customer_id`',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Step 4: Check if customer_id column exists, if not we need to add it first
SET @customer_id_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'customer_id'
);

-- If customer_id doesn't exist, add it (this handles cases where the table structure is different)
SET @sql := IF(@customer_id_exists = 0,
  'ALTER TABLE `customers` ADD COLUMN `customer_id` VARCHAR(64) NULL AFTER `customer_ref_id`',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Populate customer_id if it's NULL (for existing records)
UPDATE `customers` 
SET `customer_id` = generate_customer_id(`phone`, `company_id`)
WHERE `customer_id` IS NULL;

-- Step 5: Create temporary columns in customers table to store new values
SET @temp_col1_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'temp_new_customer_id'
);
SET @sql := IF(@temp_col1_exists = 0,
  'ALTER TABLE `customers` ADD COLUMN `temp_new_customer_id` INT(11) NULL AFTER `customer_ref_id`',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @temp_col2_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'temp_new_customer_ref_id'
);
SET @sql := IF(@temp_col2_exists = 0,
  'ALTER TABLE `customers` ADD COLUMN `temp_new_customer_ref_id` VARCHAR(64) NULL AFTER `temp_new_customer_id`',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Step 6: Populate temporary columns with new values (only if not already populated)
-- Generate new customer_ref_id (VARCHAR) from phone and company_id
-- Use existing customer_ref_id (INT) as the new customer_id (INT)
UPDATE `customers` 
SET 
  `temp_new_customer_id` = `customer_ref_id`,  -- Old customer_ref_id (INT) becomes new customer_id (INT)
  `temp_new_customer_ref_id` = generate_customer_id(`phone`, `company_id`)  -- Generated VARCHAR becomes new customer_ref_id
WHERE `temp_new_customer_id` IS NULL OR `temp_new_customer_ref_id` IS NULL;

-- Step 7: Modify customers table structure
-- First, make customer_ref_id nullable temporarily
ALTER TABLE `customers` MODIFY COLUMN `customer_ref_id` INT(11) NULL;

-- Check if customer_id already exists and what type it is
SET @customer_id_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'customers' 
    AND COLUMN_NAME = 'customer_id'
);
SET @customer_id_type := (
  SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'customers' 
    AND COLUMN_NAME = 'customer_id'
  LIMIT 1
);
SET @customer_id_extra := (
  SELECT EXTRA FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'customers' 
    AND COLUMN_NAME = 'customer_id'
  LIMIT 1
);

-- If customer_id doesn't exist, add it as INT
SET @sql := IF(@customer_id_exists = 0,
  'ALTER TABLE `customers` ADD COLUMN `customer_id` INT(11) NOT NULL FIRST',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- If customer_id is VARCHAR, drop and recreate as INT
SET @sql := IF(@customer_id_exists > 0 AND @customer_id_type LIKE '%varchar%',
  'ALTER TABLE `customers` DROP COLUMN `customer_id`; ALTER TABLE `customers` ADD COLUMN `customer_id` INT(11) NOT NULL FIRST',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Populate customer_id with values from temp_new_customer_id (if not already populated)
UPDATE `customers` 
SET `customer_id` = `temp_new_customer_id`
WHERE `temp_new_customer_id` IS NOT NULL 
  AND (`customer_id` IS NULL OR `customer_id` = 0);

-- Add PRIMARY KEY first (required before AUTO_INCREMENT) - only if not exists
SET @has_primary_key := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'customers'
    AND CONSTRAINT_TYPE = 'PRIMARY KEY'
);
SET @sql := IF(@has_primary_key = 0,
  'ALTER TABLE `customers` ADD PRIMARY KEY (`customer_id`)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Now modify to AUTO_INCREMENT and set the next value (only if not already AUTO_INCREMENT)
SET @is_auto_increment := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'customers' 
    AND COLUMN_NAME = 'customer_id'
    AND EXTRA LIKE '%auto_increment%'
);
SET @max_id := (SELECT COALESCE(MAX(customer_id), 0) FROM customers);
SET @sql := IF(@is_auto_increment = 0,
  CONCAT('ALTER TABLE `customers` MODIFY COLUMN `customer_id` INT(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT = ', @max_id + 1),
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Now change customer_ref_id from INT to VARCHAR
-- Drop UNIQUE KEY first if it exists (it will be dropped automatically when column is dropped, but let's be explicit)
SET @uniq_idx_exists_before := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'customers' 
    AND INDEX_NAME = 'uniq_customers_customer_ref_id'
);
SET @sql := IF(@uniq_idx_exists_before > 0,
  'ALTER TABLE `customers` DROP INDEX `uniq_customers_customer_ref_id`',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

ALTER TABLE `customers` DROP COLUMN `customer_ref_id`;
ALTER TABLE `customers` ADD COLUMN `customer_ref_id` VARCHAR(64) NOT NULL AFTER `customer_id`;

-- Populate customer_ref_id with values from temp_new_customer_ref_id
UPDATE `customers` 
SET `customer_ref_id` = `temp_new_customer_ref_id`
WHERE `temp_new_customer_ref_id` IS NOT NULL;

-- Step 8: Set customer_id as PRIMARY KEY (only if not exists - already added in Step 7)
SET @has_primary_key := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'customers'
    AND CONSTRAINT_TYPE = 'PRIMARY KEY'
);
SET @sql := IF(@has_primary_key = 0,
  'ALTER TABLE `customers` ADD PRIMARY KEY (`customer_id`)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Step 9: Add UNIQUE index on customer_ref_id to ensure uniqueness (only if not exists)
SET @uniq_idx_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'customers' 
    AND INDEX_NAME = 'uniq_customers_customer_ref_id'
);
SET @sql := IF(@uniq_idx_exists = 0,
  'ALTER TABLE `customers` ADD UNIQUE KEY `uniq_customers_customer_ref_id` (`customer_ref_id`)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Step 10: Update child tables - change customer_ref_id from INT to INT (pointing to new customer_id)
-- Note: At this point, customer_ref_id in customers is VARCHAR, and customer_id is INT
-- We need to update child tables to point customer_ref_id to the new customer_id (INT)
-- Use temp_new_customer_ref_id for JOIN because child tables have customer_id as VARCHAR matching the new ref_id format

-- Activities
ALTER TABLE `activities` 
  MODIFY COLUMN `customer_ref_id` INT(11) NULL;
-- Update using customer_id (VARCHAR "CUS-xxx") to find the new customer_id (INT) via temp_new_customer_ref_id
UPDATE `activities` a
INNER JOIN `customers` c ON a.customer_id = c.temp_new_customer_ref_id COLLATE utf8mb4_unicode_ci
SET a.customer_ref_id = c.customer_id
WHERE a.customer_ref_id IS NULL OR a.customer_ref_id != c.customer_id;

-- Appointments
ALTER TABLE `appointments` 
  MODIFY COLUMN `customer_ref_id` INT(11) NULL;
UPDATE `appointments` a
INNER JOIN `customers` c ON a.customer_id = c.temp_new_customer_ref_id COLLATE utf8mb4_unicode_ci
SET a.customer_ref_id = c.customer_id
WHERE a.customer_ref_id IS NULL OR a.customer_ref_id != c.customer_id;

-- Call History
ALTER TABLE `call_history` 
  MODIFY COLUMN `customer_ref_id` INT(11) NULL;
UPDATE `call_history` ch
INNER JOIN `customers` c ON ch.customer_id = c.temp_new_customer_ref_id COLLATE utf8mb4_unicode_ci
SET ch.customer_ref_id = c.customer_id
WHERE ch.customer_ref_id IS NULL OR ch.customer_ref_id != c.customer_id;

-- Customer Assignment History
ALTER TABLE `customer_assignment_history` 
  MODIFY COLUMN `customer_ref_id` INT(11) NULL;
UPDATE `customer_assignment_history` cah
INNER JOIN `customers` c ON cah.customer_id = c.temp_new_customer_ref_id COLLATE utf8mb4_unicode_ci
SET cah.customer_ref_id = c.customer_id
WHERE cah.customer_ref_id IS NULL OR cah.customer_ref_id != c.customer_id;

-- Customer Tags
ALTER TABLE `customer_tags` 
  MODIFY COLUMN `customer_ref_id` INT(11) NULL;
UPDATE `customer_tags` ct
INNER JOIN `customers` c ON ct.customer_id = c.temp_new_customer_ref_id COLLATE utf8mb4_unicode_ci
SET ct.customer_ref_id = c.customer_id
WHERE ct.customer_ref_id IS NULL OR ct.customer_ref_id != c.customer_id;

-- Orders
ALTER TABLE `orders` 
  MODIFY COLUMN `customer_ref_id` INT(11) NULL;
UPDATE `orders` o
INNER JOIN `customers` c ON o.customer_id = c.temp_new_customer_ref_id COLLATE utf8mb4_unicode_ci
SET o.customer_ref_id = c.customer_id
WHERE o.customer_ref_id IS NULL OR o.customer_ref_id != c.customer_id;

-- Customer Logs (if exists)
-- Note: customer_logs.customer_id is VARCHAR, we need to update it to INT
SET @customer_logs_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customer_logs'
);
SET @sql := IF(@customer_logs_exists > 0,
  'UPDATE `customer_logs` cl INNER JOIN `customers` c ON cl.customer_id = c.temp_new_customer_ref_id COLLATE utf8mb4_unicode_ci SET cl.customer_id = CAST(c.customer_id AS CHAR)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Step 11: Clean up temporary columns (moved after Step 10 to allow Step 10 to use temp columns)
ALTER TABLE `customers` DROP COLUMN `temp_new_customer_id`;
ALTER TABLE `customers` DROP COLUMN `temp_new_customer_ref_id`;

-- Step 12: Recreate foreign key constraints pointing to customer_id (INT)
ALTER TABLE `activities`
  ADD CONSTRAINT `fk_activity_customer` FOREIGN KEY (`customer_ref_id`) 
  REFERENCES `customers` (`customer_id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `appointments`
  ADD CONSTRAINT `fk_appt_customer` FOREIGN KEY (`customer_ref_id`) 
  REFERENCES `customers` (`customer_id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `call_history`
  ADD CONSTRAINT `fk_call_customer` FOREIGN KEY (`customer_ref_id`) 
  REFERENCES `customers` (`customer_id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `customer_assignment_history`
  ADD CONSTRAINT `fk_cah_customer` FOREIGN KEY (`customer_ref_id`) 
  REFERENCES `customers` (`customer_id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `customer_tags`
  ADD CONSTRAINT `fk_customer_tags_customer` FOREIGN KEY (`customer_ref_id`) 
  REFERENCES `customers` (`customer_id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `orders`
  ADD CONSTRAINT `fk_orders_customer` FOREIGN KEY (`customer_ref_id`) 
  REFERENCES `customers` (`customer_id`) ON UPDATE CASCADE;

-- Step 13: Recreate triggers
-- Note: DELIMITER cannot be used in prepared statements, so triggers must be created directly
-- Trigger to auto-generate customer_ref_id on INSERT
DROP TRIGGER IF EXISTS `customers_before_insert`;
CREATE TRIGGER `customers_before_insert` BEFORE INSERT ON `customers` FOR EACH ROW 
BEGIN
  SET NEW.customer_ref_id = generate_customer_id(NEW.phone, NEW.company_id);
END;

-- Trigger to auto-update customer_ref_id when phone or company_id changes
DROP TRIGGER IF EXISTS `customers_before_update`;
CREATE TRIGGER `customers_before_update` BEFORE UPDATE ON `customers` FOR EACH ROW 
BEGIN
  IF NOT (NEW.phone <=> OLD.phone) OR NOT (NEW.company_id <=> OLD.company_id) THEN
    SET NEW.customer_ref_id = generate_customer_id(NEW.phone, NEW.company_id);
  END IF;
END;

-- Recreate customer_logs trigger if needed
DROP TRIGGER IF EXISTS `customer_after_insert`;
SET @customer_logs_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customer_logs'
);

-- Recreate customer_logs trigger if customer_logs table exists
-- Note: This must be done outside prepared statement due to DELIMITER limitation
-- If customer_logs table exists, this trigger will be created after migration completes
-- For now, we'll skip it and it can be added manually if needed

-- Step 14: Update resolve_customer_pk function to work with new structure
DROP FUNCTION IF EXISTS `resolve_customer_pk`;
CREATE FUNCTION `resolve_customer_pk`(`customerIdentifier` VARCHAR(64)) RETURNS INT(11)
READS SQL DATA
DETERMINISTIC
BEGIN
  DECLARE resolvedId INT;
  IF customerIdentifier IS NULL OR customerIdentifier = '' THEN
    RETURN NULL;
  END IF;
  -- Try to find by customer_ref_id (VARCHAR) first
  SELECT customer_id INTO resolvedId
  FROM customers
  WHERE customer_ref_id COLLATE utf8mb4_unicode_ci = customerIdentifier COLLATE utf8mb4_unicode_ci
  LIMIT 1;
  -- If not found, try to parse as INT (for backward compatibility)
  IF resolvedId IS NULL AND customerIdentifier REGEXP '^[0-9]+$' THEN
    SELECT customer_id INTO resolvedId
    FROM customers
    WHERE customer_id = CAST(customerIdentifier AS UNSIGNED)
    LIMIT 1;
  END IF;
  RETURN resolvedId;
END;

-- Step 15: Update orders trigger to use new structure
DROP TRIGGER IF EXISTS `orders_customer_ref_bu`;
CREATE TRIGGER `orders_customer_ref_bu` BEFORE UPDATE ON `orders` FOR EACH ROW 
BEGIN
    DECLARE resolvedId INT;
    IF NOT (NEW.customer_id <=> OLD.customer_id) OR NEW.customer_ref_id IS NULL THEN
        SET resolvedId = resolve_customer_pk(NEW.customer_id);
        IF resolvedId IS NULL THEN
            SELECT customer_id INTO resolvedId 
            FROM customers 
            WHERE customer_ref_id = NEW.customer_id 
            LIMIT 1;
        END IF;
        IF resolvedId IS NOT NULL THEN
             SET NEW.customer_ref_id = resolvedId;
        END IF;
    END IF;
END;

-- Step 16: Add indexes for performance (only if they don't exist)
SET @idx_company_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND INDEX_NAME = 'idx_customers_company'
);
SET @sql := IF(@idx_company_exists = 0,
  'ALTER TABLE `customers` ADD KEY `idx_customers_company` (`company_id`)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_assigned_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND INDEX_NAME = 'idx_customers_assigned_to'
);
SET @sql := IF(@idx_assigned_exists = 0,
  'ALTER TABLE `customers` ADD KEY `idx_customers_assigned_to` (`assigned_to`)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_lifecycle_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND INDEX_NAME = 'idx_customers_lifecycle_status'
);
SET @sql := IF(@idx_lifecycle_exists = 0,
  'ALTER TABLE `customers` ADD KEY `idx_customers_lifecycle_status` (`lifecycle_status`)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_ownership_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND INDEX_NAME = 'idx_customers_ownership_expires'
);
SET @sql := IF(@idx_ownership_exists = 0,
  'ALTER TABLE `customers` ADD KEY `idx_customers_ownership_expires` (`ownership_expires`)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_date_assigned_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND INDEX_NAME = 'idx_customers_date_assigned'
);
SET @sql := IF(@idx_date_assigned_exists = 0,
  'ALTER TABLE `customers` ADD KEY `idx_customers_date_assigned` (`date_assigned`)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_blocked_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND INDEX_NAME = 'idx_customers_blocked'
);
SET @sql := IF(@idx_blocked_exists = 0,
  'ALTER TABLE `customers` ADD KEY `idx_customers_blocked` (`is_blocked`)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_waiting_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND INDEX_NAME = 'idx_customers_waiting'
);
SET @sql := IF(@idx_waiting_exists = 0,
  'ALTER TABLE `customers` ADD KEY `idx_customers_waiting` (`is_in_waiting_basket`)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_company_status_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND INDEX_NAME = 'idx_customers_company_status'
);
SET @sql := IF(@idx_company_status_exists = 0,
  'ALTER TABLE `customers` ADD KEY `idx_customers_company_status` (`company_id`,`lifecycle_status`)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_company_assigned_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND INDEX_NAME = 'idx_customers_company_assigned'
);
SET @sql := IF(@idx_company_assigned_exists = 0,
  'ALTER TABLE `customers` ADD KEY `idx_customers_company_assigned` (`company_id`,`assigned_to`)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Step 17: Verify migration
SELECT 
  'Migration completed successfully!' AS status,
  COUNT(*) AS total_customers,
  COUNT(DISTINCT customer_id) AS unique_customer_ids,
  COUNT(DISTINCT customer_ref_id) AS unique_customer_ref_ids
FROM customers;

COMMIT;

-- Migration completed!
-- Note: After running this migration, you may need to update your application code
-- to use customer_id (INT) for foreign key references and customer_ref_id (VARCHAR) 
-- for display/business logic purposes.

