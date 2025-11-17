-- Migration: Create platforms table and add company_id support
-- Date: 2025-11-14

SET @dbname = DATABASE();

-- Create platforms table if it doesn't exist
CREATE TABLE IF NOT EXISTS `platforms` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(64) NOT NULL,
  `display_name` VARCHAR(128) NOT NULL,
  `description` VARCHAR(255) DEFAULT NULL,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `sort_order` INT(11) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_platforms_name` (`name`),
  KEY `idx_platforms_active` (`active`),
  KEY `idx_platforms_sort_order` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add company_id column if it doesn't exist
SET @tablename = 'platforms';
SET @columnname = 'company_id';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_schema = @dbname)
      AND (table_name = @tablename)
      AND (column_name = @columnname)
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' INT(11) NOT NULL DEFAULT 1 AFTER description, ADD KEY `idx_platforms_company_id` (`', @columnname, '`), ADD CONSTRAINT `fk_platforms_company` FOREIGN KEY (`', @columnname, '`) REFERENCES `companies` (`id`) ON DELETE CASCADE')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Drop old unique key if it exists (without company_id)
SET @indexname = 'uk_platforms_name';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE
      (table_schema = @dbname)
      AND (table_name = @tablename)
      AND (index_name = @indexname)
  ) > 0,
  CONCAT('ALTER TABLE ', @tablename, ' DROP INDEX ', @indexname),
  'SELECT 1'
));
PREPARE dropIndexIfExists FROM @preparedStatement;
EXECUTE dropIndexIfExists;
DEALLOCATE PREPARE dropIndexIfExists;

-- Add new unique key with company_id if it doesn't exist
SET @indexname = 'uk_platforms_company_name';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE
      (table_schema = @dbname)
      AND (table_name = @tablename)
      AND (index_name = @indexname)
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD UNIQUE KEY `', @indexname, '` (`company_id`, `name`)')
));
PREPARE addIndexIfNotExists FROM @preparedStatement;
EXECUTE addIndexIfNotExists;
DEALLOCATE PREPARE addIndexIfNotExists;

-- Note: Initial data should be inserted per company via admin interface
-- This migration only creates/updates the table structure

