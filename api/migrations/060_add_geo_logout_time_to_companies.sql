-- Migration: 056_add_geo_logout_time_to_companies
-- Description: Daily forced-logout time for geo-fenced users (e.g. 19:30 so a
--              session opened at the office cannot be carried home for the
--              evening). NULL keeps the previous behavior: expire at midnight.

SET @exist := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_name = 'companies'
    AND column_name = 'geo_logout_time'
    AND table_schema = DATABASE()
);
SET @sqlstmt := IF(@exist = 0,
  'ALTER TABLE companies ADD COLUMN geo_logout_time TIME NULL DEFAULT NULL',
  'SELECT 1');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
