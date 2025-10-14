-- Migration: Add external platform mapping column to users
-- Purpose: store external user id for Admin Page integrations
-- Safe for repeated runs (checks column and index existence)

USE `mini_erp`;

-- 1) Add column `id_oth` VARCHAR(191) NULL after supervisor_id if not exists
SET @col := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'id_oth'
);
SET @sql := IF(@col = 0,
  'ALTER TABLE `users` ADD COLUMN `id_oth` VARCHAR(191) NULL AFTER `supervisor_id`;',
  'SELECT 1;'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2) Create index for faster lookup by external id
SET @idx := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND INDEX_NAME = 'idx_users_id_oth'
);
SET @sql := IF(@idx = 0,
  'CREATE INDEX `idx_users_id_oth` ON `users` (`id_oth`);',
  'SELECT 1;'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

