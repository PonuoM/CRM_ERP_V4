-- Migration: Add last_activity column and auto-logout event
-- Date: 2026-01-06
-- Purpose: Track active browser sessions and auto-logout stale sessions
-- NOTE: Run this on your production database (not mini_erp)

-- 1) Add last_activity column to track heartbeat pings
-- Using procedure to check if column exists first
DROP PROCEDURE IF EXISTS add_last_activity_column;
DELIMITER $$
CREATE PROCEDURE add_last_activity_column()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'user_login_history' 
      AND COLUMN_NAME = 'last_activity'
  ) THEN
    ALTER TABLE user_login_history ADD COLUMN last_activity DATETIME NULL AFTER logout_time;
  END IF;
END $$
DELIMITER ;

CALL add_last_activity_column();
DROP PROCEDURE IF EXISTS add_last_activity_column;

-- Create index for efficient stale session queries (ignore error if exists)
CREATE INDEX idx_last_activity ON user_login_history(last_activity);

-- 2) Create scheduled event to auto-close stale sessions (no ping for 3 minutes)
DROP EVENT IF EXISTS evt_auto_logout_stale_sessions;

DELIMITER $$
CREATE EVENT evt_auto_logout_stale_sessions
ON SCHEDULE EVERY 1 MINUTE
STARTS CURRENT_TIMESTAMP
DO
BEGIN
  -- Close sessions that haven't pinged in 3 minutes
  UPDATE user_login_history
  SET logout_time = COALESCE(last_activity, login_time),
      session_duration = TIMESTAMPDIFF(SECOND, login_time, COALESCE(last_activity, login_time))
  WHERE logout_time IS NULL 
    AND last_activity IS NOT NULL
    AND last_activity < DATE_SUB(NOW(), INTERVAL 3 MINUTE);
    
  -- Also close sessions that never pinged and are older than 3 minutes
  UPDATE user_login_history
  SET logout_time = login_time,
      session_duration = 0
  WHERE logout_time IS NULL 
    AND last_activity IS NULL
    AND login_time < DATE_SUB(NOW(), INTERVAL 3 MINUTE);
END $$
DELIMITER ;

-- Enable event scheduler if not already enabled
SET GLOBAL event_scheduler = ON;
