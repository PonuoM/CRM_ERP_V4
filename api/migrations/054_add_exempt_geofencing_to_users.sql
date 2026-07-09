-- Migration: 054_add_exempt_geofencing_to_users
-- Description: Per-user exemption from geo-fencing. Lets specific users inside a
--              geo-fenced role (e.g. a "senior" Supervisor Telesale without
--              subordinates) log in from anywhere, while the rest of the role
--              stays geo-fenced. Default 0 preserves existing behavior.

SET @exist := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_name = 'users'
    AND column_name = 'exempt_geofencing'
    AND table_schema = DATABASE()
);
SET @sqlstmt := IF(@exist = 0,
  'ALTER TABLE users ADD COLUMN exempt_geofencing TINYINT(1) NOT NULL DEFAULT 0',
  'SELECT 1');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
