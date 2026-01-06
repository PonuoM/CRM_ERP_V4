-- Migration: Heartbeat Auto-Logout (SERVER VERSION)
-- Date: 2026-01-06
-- For: Shared hosting (no SUPER privilege needed)
-- NOTE: Select your database in phpMyAdmin first, then run this

-- 1) Add last_activity column (safe to run multiple times)
SET @col_exists = (
    SELECT COUNT(*) FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'user_login_history' 
      AND COLUMN_NAME = 'last_activity'
);

SET @sql = IF(@col_exists = 0, 
    'ALTER TABLE user_login_history ADD COLUMN last_activity DATETIME NULL AFTER logout_time',
    'SELECT "Column last_activity already exists" AS result'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2) Add index (ignore error if already exists)
-- Run this separately, ignore "Duplicate key name" error
-- CREATE INDEX idx_last_activity ON user_login_history(last_activity);
