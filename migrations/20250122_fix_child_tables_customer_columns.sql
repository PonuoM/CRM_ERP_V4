-- Migration: Fix customer_id and customer_ref_id in child tables
-- Date: 2025-01-22
-- Description: 
--   - Swap customer_id and customer_ref_id in child tables to match new structure
--   - customer_id should be INT(11) (pointing to customers.customer_id)
--   - customer_ref_id should be VARCHAR(64) (storing "CUS-xxx" format)
--
-- IMPORTANT: Backup your database before running this migration!

START TRANSACTION;

-- Step 1: Drop all foreign key constraints
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

-- Step 2: For each table, swap customer_id and customer_ref_id
-- Strategy: 
-- 1. Add temp columns
-- 2. Populate temp columns with swapped values
-- 3. Drop old columns
-- 4. Rename temp columns

-- ============================================
-- ACTIVITIES TABLE
-- ============================================
-- Check if already migrated (customer_id is INT and customer_ref_id is VARCHAR)
SET @customer_id_type := (
  SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'activities'
    AND COLUMN_NAME = 'customer_id'
  LIMIT 1
);
SET @customer_ref_id_type := (
  SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'activities'
    AND COLUMN_NAME = 'customer_ref_id'
  LIMIT 1
);
SET @already_migrated := IF(@customer_id_type LIKE '%int%' AND @customer_ref_id_type LIKE '%varchar%', 1, 0);

-- Only process if not already migrated
-- Check if temp columns already exist
SET @temp_id_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'activities'
    AND COLUMN_NAME = 'temp_customer_id'
);
SET @sql := IF(@already_migrated = 0 AND @temp_id_exists = 0,
  'ALTER TABLE `activities` ADD COLUMN `temp_customer_id` INT(11) NULL AFTER `customer_ref_id`',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @temp_ref_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'activities'
    AND COLUMN_NAME = 'temp_customer_ref_id'
);
SET @sql := IF(@already_migrated = 0 AND @temp_ref_exists = 0,
  'ALTER TABLE `activities` ADD COLUMN `temp_customer_ref_id` VARCHAR(64) NULL AFTER `temp_customer_id`',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Populate temp columns: swap values (only if not already populated and not migrated)
SET @sql := IF(@already_migrated = 0,
  'UPDATE `activities` 
  SET 
    `temp_customer_id` = `customer_ref_id`,
    `temp_customer_ref_id` = `customer_id`
  WHERE `customer_ref_id` IS NOT NULL 
    AND (`temp_customer_id` IS NULL OR `temp_customer_ref_id` IS NULL)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- For records where customer_ref_id is NULL, try to find customer_id from customers table
SET @sql := IF(@already_migrated = 0,
  'UPDATE `activities` a
  INNER JOIN `customers` c ON CONVERT(a.customer_id USING utf8mb4) COLLATE utf8mb4_unicode_ci = CONVERT(c.customer_ref_id USING utf8mb4) COLLATE utf8mb4_unicode_ci
  SET 
    `temp_customer_id` = c.customer_id,
    `temp_customer_ref_id` = c.customer_ref_id
  WHERE a.temp_customer_id IS NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Drop old columns (only if not migrated)
SET @sql := IF(@already_migrated = 0,
  'ALTER TABLE `activities` 
    DROP COLUMN `customer_id`,
    DROP COLUMN `customer_ref_id`',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Rename temp columns (only if not migrated)
SET @sql := IF(@already_migrated = 0,
  'ALTER TABLE `activities` 
    CHANGE COLUMN `temp_customer_id` `customer_id` INT(11) NULL,
    CHANGE COLUMN `temp_customer_ref_id` `customer_ref_id` VARCHAR(64) NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================
-- APPOINTMENTS TABLE
-- ============================================
SET @temp_id_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'appointments'
    AND COLUMN_NAME = 'temp_customer_id'
);
SET @sql := IF(@temp_id_exists = 0,
  'ALTER TABLE `appointments` ADD COLUMN `temp_customer_id` INT(11) NULL AFTER `customer_ref_id`',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @temp_ref_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'appointments'
    AND COLUMN_NAME = 'temp_customer_ref_id'
);
SET @sql := IF(@temp_ref_exists = 0,
  'ALTER TABLE `appointments` ADD COLUMN `temp_customer_ref_id` VARCHAR(64) NULL AFTER `temp_customer_id`',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE `appointments` 
SET 
  `temp_customer_id` = `customer_ref_id`,
  `temp_customer_ref_id` = `customer_id`
WHERE `customer_ref_id` IS NOT NULL 
  AND (`temp_customer_id` IS NULL OR `temp_customer_ref_id` IS NULL);

UPDATE `appointments` a
INNER JOIN `customers` c ON CONVERT(a.customer_id USING utf8mb4) COLLATE utf8mb4_unicode_ci = CONVERT(c.customer_ref_id USING utf8mb4) COLLATE utf8mb4_unicode_ci
SET 
  `temp_customer_id` = c.customer_id,
  `temp_customer_ref_id` = c.customer_ref_id
WHERE a.temp_customer_id IS NULL;

ALTER TABLE `appointments` 
  DROP COLUMN `customer_id`,
  DROP COLUMN `customer_ref_id`;

ALTER TABLE `appointments` 
  CHANGE COLUMN `temp_customer_id` `customer_id` INT(11) NULL,
  CHANGE COLUMN `temp_customer_ref_id` `customer_ref_id` VARCHAR(64) NULL;

-- ============================================
-- CALL_HISTORY TABLE
-- ============================================
SET @temp_id_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'call_history'
    AND COLUMN_NAME = 'temp_customer_id'
);
SET @sql := IF(@temp_id_exists = 0,
  'ALTER TABLE `call_history` ADD COLUMN `temp_customer_id` INT(11) NULL AFTER `customer_ref_id`',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @temp_ref_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'call_history'
    AND COLUMN_NAME = 'temp_customer_ref_id'
);
SET @sql := IF(@temp_ref_exists = 0,
  'ALTER TABLE `call_history` ADD COLUMN `temp_customer_ref_id` VARCHAR(64) NULL AFTER `temp_customer_id`',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE `call_history` 
SET 
  `temp_customer_id` = `customer_ref_id`,
  `temp_customer_ref_id` = `customer_id`
WHERE `customer_ref_id` IS NOT NULL 
  AND (`temp_customer_id` IS NULL OR `temp_customer_ref_id` IS NULL);

UPDATE `call_history` ch
INNER JOIN `customers` c ON CONVERT(ch.customer_id USING utf8mb4) COLLATE utf8mb4_unicode_ci = CONVERT(c.customer_ref_id USING utf8mb4) COLLATE utf8mb4_unicode_ci
SET 
  `temp_customer_id` = c.customer_id,
  `temp_customer_ref_id` = c.customer_ref_id
WHERE ch.temp_customer_id IS NULL;

ALTER TABLE `call_history` 
  DROP COLUMN `customer_id`,
  DROP COLUMN `customer_ref_id`;

ALTER TABLE `call_history` 
  CHANGE COLUMN `temp_customer_id` `customer_id` INT(11) NULL,
  CHANGE COLUMN `temp_customer_ref_id` `customer_ref_id` VARCHAR(64) NULL;

-- ============================================
-- CUSTOMER_ASSIGNMENT_HISTORY TABLE
-- ============================================
-- Drop UNIQUE KEY first to avoid duplicate entry error
SET @uniq_key_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'customer_assignment_history'
    AND INDEX_NAME = 'uniq_customer_user_first'
);
SET @sql := IF(@uniq_key_exists > 0,
  'ALTER TABLE `customer_assignment_history` DROP INDEX `uniq_customer_user_first`',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Check if temp columns already exist
SET @temp_id_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'customer_assignment_history'
    AND COLUMN_NAME = 'temp_customer_id'
);
SET @sql := IF(@temp_id_exists = 0,
  'ALTER TABLE `customer_assignment_history` ADD COLUMN `temp_customer_id` INT(11) NULL AFTER `customer_ref_id`',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @temp_ref_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'customer_assignment_history'
    AND COLUMN_NAME = 'temp_customer_ref_id'
);
SET @sql := IF(@temp_ref_exists = 0,
  'ALTER TABLE `customer_assignment_history` ADD COLUMN `temp_customer_ref_id` VARCHAR(64) NULL AFTER `temp_customer_id`',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Populate temp columns: swap values
UPDATE `customer_assignment_history` 
SET 
  `temp_customer_id` = `customer_ref_id`,
  `temp_customer_ref_id` = `customer_id`
WHERE `customer_ref_id` IS NOT NULL 
  AND (`temp_customer_id` IS NULL OR `temp_customer_ref_id` IS NULL);

-- For records where customer_ref_id is NULL, try to find from customers table
UPDATE `customer_assignment_history` cah
INNER JOIN `customers` c ON CONVERT(cah.customer_id USING utf8mb4) COLLATE utf8mb4_unicode_ci = CONVERT(c.customer_ref_id USING utf8mb4) COLLATE utf8mb4_unicode_ci
SET 
  `temp_customer_id` = c.customer_id,
  `temp_customer_ref_id` = c.customer_ref_id
WHERE cah.temp_customer_id IS NULL;

-- Handle duplicates: If multiple records have same (temp_customer_id, user_id), keep only the first one
-- Delete duplicates but keep the one with smallest id
DELETE cah1 FROM `customer_assignment_history` cah1
INNER JOIN `customer_assignment_history` cah2
WHERE cah1.temp_customer_id IS NOT NULL
  AND cah1.temp_customer_id = cah2.temp_customer_id
  AND cah1.user_id = cah2.user_id
  AND cah1.id > cah2.id;

-- Drop old columns
ALTER TABLE `customer_assignment_history` 
  DROP COLUMN `customer_id`,
  DROP COLUMN `customer_ref_id`;

-- Rename temp columns
ALTER TABLE `customer_assignment_history` 
  CHANGE COLUMN `temp_customer_id` `customer_id` INT(11) NULL,
  CHANGE COLUMN `temp_customer_ref_id` `customer_ref_id` VARCHAR(64) NULL;

-- Clean up records that cannot be mapped (customer_id = NULL)
-- These are records with customer_id (VARCHAR) that don't exist in customers table
-- Option 1: Delete them (uncomment if you want to delete)
-- DELETE FROM `customer_assignment_history` WHERE `customer_id` IS NULL;

-- Option 2: Keep them but they won't have UNIQUE constraint
-- For now, we'll skip recreating UNIQUE KEY if there are NULL values
-- You can manually clean up and recreate UNIQUE KEY later if needed
SET @has_null_customer_id := (
  SELECT COUNT(*) FROM `customer_assignment_history` WHERE `customer_id` IS NULL
);
SET @sql := IF(@has_null_customer_id = 0,
  'ALTER TABLE `customer_assignment_history` ADD UNIQUE KEY `uniq_customer_user_first` (`customer_id`, `user_id`)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================
-- CUSTOMER_TAGS TABLE
-- ============================================
-- Check if customer_id and customer_ref_id still exist (if not, skip this table)
SET @has_customer_id := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'customer_tags'
    AND COLUMN_NAME = 'customer_id'
);
SET @has_customer_ref_id := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'customer_tags'
    AND COLUMN_NAME = 'customer_ref_id'
);

-- Only process if both columns exist
-- Note: If columns don't exist, customer_tags has already been migrated, skip it
SET @should_process := IF(@has_customer_id > 0 AND @has_customer_ref_id > 0, 1, 0);

-- Drop PRIMARY KEY if exists
SET @has_pk := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'customer_tags'
    AND CONSTRAINT_TYPE = 'PRIMARY KEY'
);
SET @sql := IF(@should_process > 0 AND @has_pk > 0,
  'ALTER TABLE `customer_tags` DROP PRIMARY KEY',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add temp columns if not exist
SET @temp_id_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'customer_tags'
    AND COLUMN_NAME = 'temp_customer_id'
);
-- Check if customer_ref_id exists before using AFTER clause
SET @customer_ref_id_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'customer_tags'
    AND COLUMN_NAME = 'customer_ref_id'
);
SET @sql := IF(@should_process > 0 AND @temp_id_exists = 0 AND @customer_ref_id_exists > 0,
  'ALTER TABLE `customer_tags` ADD COLUMN `temp_customer_id` INT(11) NULL AFTER `customer_ref_id`',
  IF(@should_process > 0 AND @temp_id_exists = 0,
    'ALTER TABLE `customer_tags` ADD COLUMN `temp_customer_id` INT(11) NULL',
    'SELECT 1'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @temp_ref_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'customer_tags'
    AND COLUMN_NAME = 'temp_customer_ref_id'
);
SET @sql := IF(@should_process > 0 AND @temp_ref_exists = 0,
  'ALTER TABLE `customer_tags` ADD COLUMN `temp_customer_ref_id` VARCHAR(64) NULL AFTER `temp_customer_id`',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Populate temp columns (only if columns exist)
SET @sql := IF(@should_process > 0,
  'UPDATE `customer_tags` 
  SET 
    `temp_customer_id` = `customer_ref_id`,
    `temp_customer_ref_id` = `customer_id`
  WHERE `customer_ref_id` IS NOT NULL 
    AND (`temp_customer_id` IS NULL OR `temp_customer_ref_id` IS NULL)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(@should_process > 0,
  'UPDATE `customer_tags` ct
  INNER JOIN `customers` c ON CONVERT(ct.customer_id USING utf8mb4) COLLATE utf8mb4_unicode_ci = CONVERT(c.customer_ref_id USING utf8mb4) COLLATE utf8mb4_unicode_ci
  SET 
    `temp_customer_id` = c.customer_id,
    `temp_customer_ref_id` = c.customer_ref_id
  WHERE ct.temp_customer_id IS NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Drop old columns (only if columns exist)
SET @sql := IF(@should_process > 0,
  'ALTER TABLE `customer_tags` 
    DROP COLUMN `customer_id`,
    DROP COLUMN `customer_ref_id`',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Rename temp columns (only if temp columns exist)
SET @sql := IF(@should_process > 0,
  'ALTER TABLE `customer_tags` 
    CHANGE COLUMN `temp_customer_id` `customer_id` INT(11) NULL,
    CHANGE COLUMN `temp_customer_ref_id` `customer_ref_id` VARCHAR(64) NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Recreate PRIMARY KEY if tag_id column exists
SET @tag_id_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'customer_tags'
    AND COLUMN_NAME = 'tag_id'
);
SET @sql := IF(@should_process > 0 AND @tag_id_exists > 0,
  'ALTER TABLE `customer_tags` ADD PRIMARY KEY (`customer_id`, `tag_id`)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================
-- ORDERS TABLE
-- ============================================
SET @temp_id_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'orders'
    AND COLUMN_NAME = 'temp_customer_id'
);
SET @sql := IF(@temp_id_exists = 0,
  'ALTER TABLE `orders` ADD COLUMN `temp_customer_id` INT(11) NULL AFTER `customer_ref_id`',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @temp_ref_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'orders'
    AND COLUMN_NAME = 'temp_customer_ref_id'
);
SET @sql := IF(@temp_ref_exists = 0,
  'ALTER TABLE `orders` ADD COLUMN `temp_customer_ref_id` VARCHAR(64) NULL AFTER `temp_customer_id`',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE `orders` 
SET 
  `temp_customer_id` = `customer_ref_id`,
  `temp_customer_ref_id` = `customer_id`
WHERE `customer_ref_id` IS NOT NULL 
  AND (`temp_customer_id` IS NULL OR `temp_customer_ref_id` IS NULL);

UPDATE `orders` o
INNER JOIN `customers` c ON CONVERT(o.customer_id USING utf8mb4) COLLATE utf8mb4_unicode_ci = CONVERT(c.customer_ref_id USING utf8mb4) COLLATE utf8mb4_unicode_ci
SET 
  `temp_customer_id` = c.customer_id,
  `temp_customer_ref_id` = c.customer_ref_id
WHERE o.temp_customer_id IS NULL;

ALTER TABLE `orders` 
  DROP COLUMN `customer_id`,
  DROP COLUMN `customer_ref_id`;

ALTER TABLE `orders` 
  CHANGE COLUMN `temp_customer_id` `customer_id` INT(11) NULL,
  CHANGE COLUMN `temp_customer_ref_id` `customer_ref_id` VARCHAR(64) NULL;

-- Step 3: Recreate foreign key constraints
-- Note: Foreign keys should point to customer_id (INT) in customers table
-- First, try to fix records with customer_id = 0 by mapping from customer_ref_id
-- Try mapping by customer_ref_id (VARCHAR) first
UPDATE `activities` a
INNER JOIN `customers` c ON CONVERT(a.customer_ref_id USING utf8mb4) COLLATE utf8mb4_unicode_ci = CONVERT(c.customer_ref_id USING utf8mb4) COLLATE utf8mb4_unicode_ci
SET a.`customer_id` = c.customer_id
WHERE a.`customer_id` = 0 
  AND a.customer_ref_id IS NOT NULL;

-- If still 0, try mapping by casting customer_ref_id to INT (for old format)
UPDATE `activities` a
INNER JOIN `customers` c ON CAST(a.customer_ref_id AS UNSIGNED) = c.customer_id
SET a.`customer_id` = c.customer_id
WHERE a.`customer_id` = 0 
  AND a.customer_ref_id IS NOT NULL
  AND a.customer_ref_id REGEXP '^[0-9]+$';

-- Clean up invalid records (values that don't exist in customers)
UPDATE `activities` a
LEFT JOIN `customers` c ON a.customer_id = c.customer_id
SET a.`customer_id` = NULL 
WHERE a.`customer_id` IS NOT NULL 
  AND a.`customer_id` != 0
  AND c.customer_id IS NULL;

-- Set remaining 0 values to NULL
UPDATE `activities` 
SET `customer_id` = NULL 
WHERE `customer_id` = 0;

-- Now create foreign key (NULL values are allowed)
ALTER TABLE `activities`
  ADD CONSTRAINT `fk_activity_customer` FOREIGN KEY (`customer_id`) 
  REFERENCES `customers` (`customer_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- First, try to fix records with customer_id = 0 by mapping from customer_ref_id
UPDATE `appointments` a
INNER JOIN `customers` c ON CONVERT(a.customer_ref_id USING utf8mb4) COLLATE utf8mb4_unicode_ci = CONVERT(c.customer_ref_id USING utf8mb4) COLLATE utf8mb4_unicode_ci
SET a.`customer_id` = c.customer_id
WHERE a.`customer_id` = 0 
  AND a.customer_ref_id IS NOT NULL;

UPDATE `appointments` a
INNER JOIN `customers` c ON CAST(a.customer_ref_id AS UNSIGNED) = c.customer_id
SET a.`customer_id` = c.customer_id
WHERE a.`customer_id` = 0 
  AND a.customer_ref_id IS NOT NULL
  AND a.customer_ref_id REGEXP '^[0-9]+$';

-- Clean up invalid records
UPDATE `appointments` a
LEFT JOIN `customers` c ON a.customer_id = c.customer_id
SET a.`customer_id` = NULL 
WHERE a.`customer_id` IS NOT NULL 
  AND a.`customer_id` != 0
  AND c.customer_id IS NULL;

UPDATE `appointments` 
SET `customer_id` = NULL 
WHERE `customer_id` = 0;

ALTER TABLE `appointments`
  ADD CONSTRAINT `fk_appt_customer` FOREIGN KEY (`customer_id`) 
  REFERENCES `customers` (`customer_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- First, try to fix records with customer_id = 0 by mapping from customer_ref_id
UPDATE `call_history` ch
INNER JOIN `customers` c ON CONVERT(ch.customer_ref_id USING utf8mb4) COLLATE utf8mb4_unicode_ci = CONVERT(c.customer_ref_id USING utf8mb4) COLLATE utf8mb4_unicode_ci
SET ch.`customer_id` = c.customer_id
WHERE ch.`customer_id` = 0 
  AND ch.customer_ref_id IS NOT NULL;

UPDATE `call_history` ch
INNER JOIN `customers` c ON CAST(ch.customer_ref_id AS UNSIGNED) = c.customer_id
SET ch.`customer_id` = c.customer_id
WHERE ch.`customer_id` = 0 
  AND ch.customer_ref_id IS NOT NULL
  AND ch.customer_ref_id REGEXP '^[0-9]+$';

-- Clean up invalid records
UPDATE `call_history` ch
LEFT JOIN `customers` c ON ch.customer_id = c.customer_id
SET ch.`customer_id` = NULL 
WHERE ch.`customer_id` IS NOT NULL 
  AND ch.`customer_id` != 0
  AND c.customer_id IS NULL;

UPDATE `call_history` 
SET `customer_id` = NULL 
WHERE `customer_id` = 0;

ALTER TABLE `call_history`
  ADD CONSTRAINT `fk_call_customer` FOREIGN KEY (`customer_id`) 
  REFERENCES `customers` (`customer_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- First, try to fix records with customer_id = 0 by mapping from customer_ref_id
UPDATE `customer_assignment_history` cah
INNER JOIN `customers` c ON CONVERT(cah.customer_ref_id USING utf8mb4) COLLATE utf8mb4_unicode_ci = CONVERT(c.customer_ref_id USING utf8mb4) COLLATE utf8mb4_unicode_ci
SET cah.`customer_id` = c.customer_id
WHERE cah.`customer_id` = 0 
  AND cah.customer_ref_id IS NOT NULL;

UPDATE `customer_assignment_history` cah
INNER JOIN `customers` c ON CAST(cah.customer_ref_id AS UNSIGNED) = c.customer_id
SET cah.`customer_id` = c.customer_id
WHERE cah.`customer_id` = 0 
  AND cah.customer_ref_id IS NOT NULL
  AND cah.customer_ref_id REGEXP '^[0-9]+$';

-- Clean up invalid records
UPDATE `customer_assignment_history` cah
LEFT JOIN `customers` c ON cah.customer_id = c.customer_id
SET cah.`customer_id` = NULL 
WHERE cah.`customer_id` IS NOT NULL 
  AND cah.`customer_id` != 0
  AND c.customer_id IS NULL;

UPDATE `customer_assignment_history` 
SET `customer_id` = NULL 
WHERE `customer_id` = 0;

ALTER TABLE `customer_assignment_history`
  ADD CONSTRAINT `fk_cah_customer` FOREIGN KEY (`customer_id`) 
  REFERENCES `customers` (`customer_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- First, try to fix records with customer_id = 0 by mapping from customer_ref_id
-- Note: Skip if customer_tags doesn't have customer_id column (already migrated)
SET @has_customer_id_col := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'customer_tags'
    AND COLUMN_NAME = 'customer_id'
);
SET @sql := IF(@has_customer_id_col > 0,
  'UPDATE `customer_tags` ct
  INNER JOIN `customers` c ON CONVERT(ct.customer_ref_id USING utf8mb4) COLLATE utf8mb4_unicode_ci = CONVERT(c.customer_ref_id USING utf8mb4) COLLATE utf8mb4_unicode_ci
  SET ct.`customer_id` = c.customer_id
  WHERE ct.`customer_id` = 0 
    AND ct.customer_ref_id IS NOT NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(@has_customer_id_col > 0,
  'UPDATE `customer_tags` ct
  INNER JOIN `customers` c ON CAST(ct.customer_ref_id AS UNSIGNED) = c.customer_id
  SET ct.`customer_id` = c.customer_id
  WHERE ct.`customer_id` = 0 
    AND ct.customer_ref_id IS NOT NULL
    AND ct.customer_ref_id REGEXP ''^[0-9]+$''',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Clean up invalid records (only if customer_id column exists)
SET @has_customer_id_col := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'customer_tags'
    AND COLUMN_NAME = 'customer_id'
);
SET @sql := IF(@has_customer_id_col > 0,
  'UPDATE `customer_tags` ct
  LEFT JOIN `customers` c ON ct.customer_id = c.customer_id
  SET ct.`customer_id` = NULL 
  WHERE ct.`customer_id` IS NOT NULL 
    AND ct.`customer_id` != 0
    AND c.customer_id IS NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(@has_customer_id_col > 0,
  'UPDATE `customer_tags` 
  SET `customer_id` = NULL 
  WHERE `customer_id` = 0',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

ALTER TABLE `customer_tags`
  ADD CONSTRAINT `fk_customer_tags_customer` FOREIGN KEY (`customer_id`) 
  REFERENCES `customers` (`customer_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- First, try to fix records with customer_id = 0 by mapping from customer_ref_id
UPDATE `orders` o
INNER JOIN `customers` c ON CONVERT(o.customer_ref_id USING utf8mb4) COLLATE utf8mb4_unicode_ci = CONVERT(c.customer_ref_id USING utf8mb4) COLLATE utf8mb4_unicode_ci
SET o.`customer_id` = c.customer_id
WHERE o.`customer_id` = 0 
  AND o.customer_ref_id IS NOT NULL;

UPDATE `orders` o
INNER JOIN `customers` c ON CAST(o.customer_ref_id AS UNSIGNED) = c.customer_id
SET o.`customer_id` = c.customer_id
WHERE o.`customer_id` = 0 
  AND o.customer_ref_id IS NOT NULL
  AND o.customer_ref_id REGEXP '^[0-9]+$';

-- Clean up invalid records
UPDATE `orders` o
LEFT JOIN `customers` c ON o.customer_id = c.customer_id
SET o.`customer_id` = NULL 
WHERE o.`customer_id` IS NOT NULL 
  AND o.`customer_id` != 0
  AND c.customer_id IS NULL;

UPDATE `orders` 
SET `customer_id` = NULL 
WHERE `customer_id` = 0;

ALTER TABLE `orders`
  ADD CONSTRAINT `fk_orders_customer` FOREIGN KEY (`customer_id`) 
  REFERENCES `customers` (`customer_id`) ON UPDATE CASCADE;

-- Step 4: Verify migration
SELECT 
  'Migration completed successfully!' AS status,
  (SELECT COUNT(*) FROM activities) AS activities_count,
  (SELECT COUNT(*) FROM appointments) AS appointments_count,
  (SELECT COUNT(*) FROM call_history) AS call_history_count,
  (SELECT COUNT(*) FROM customer_assignment_history) AS cah_count,
  (SELECT COUNT(*) FROM customer_tags) AS customer_tags_count,
  (SELECT COUNT(*) FROM orders) AS orders_count;

COMMIT;

-- Migration completed!
-- Note: After running this migration, all child tables will have:
--   - customer_id: INT(11) pointing to customers.customer_id
--   - customer_ref_id: VARCHAR(64) storing "CUS-xxx" format

