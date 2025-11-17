-- Migration: Add show_pages_from column to platforms table
-- Date: 2025-11-14
-- Description: Allows a platform to show pages from another platform (e.g., "โทร" can show pages from "facebook")

SET @dbname = DATABASE();
SET @tablename = 'platforms';
SET @columnname = 'show_pages_from';

-- Add show_pages_from column if it doesn't exist
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_schema = @dbname)
      AND (table_name = @tablename)
      AND (column_name = @columnname)
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' VARCHAR(64) NULL AFTER sort_order, ADD KEY `idx_platforms_show_pages_from` (`', @columnname, '`)')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Note: show_pages_from stores the platform name (e.g., 'facebook', 'line', 'tiktok')
-- If NULL, the platform shows pages from its own name
-- If set, it shows pages from the specified platform instead

