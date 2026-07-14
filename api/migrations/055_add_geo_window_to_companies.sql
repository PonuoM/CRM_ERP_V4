-- Migration: 055_add_geo_window_to_companies
-- Description: Per-company "open window" for geo-fencing. Inside the window
--              (e.g. Mon-Sat 08:30-18:30) logins skip the location check so
--              office desktops without GPS can sign in; outside the window the
--              GPS radius check applies as usual. All three columns NULL means
--              no window (location is checked at every login, current behavior).
-- geo_window_days: 7 chars of 0/1, index 0 = Monday ... index 6 = Sunday.

SET @exist := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_name = 'companies'
    AND column_name = 'geo_window_start'
    AND table_schema = DATABASE()
);
SET @sqlstmt := IF(@exist = 0,
  'ALTER TABLE companies
     ADD COLUMN geo_window_start TIME NULL DEFAULT NULL,
     ADD COLUMN geo_window_end TIME NULL DEFAULT NULL,
     ADD COLUMN geo_window_days VARCHAR(7) NULL DEFAULT NULL',
  'SELECT 1');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
