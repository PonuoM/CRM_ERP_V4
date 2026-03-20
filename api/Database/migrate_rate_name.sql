-- migrate_rate_name.sql
-- Adds rate_name column to quota_rate_schedules for user-defined rate labels
-- Safe to re-run (uses IF NOT EXISTS pattern via procedure)

DELIMITER //
CREATE PROCEDURE IF NOT EXISTS _migrate_rate_name()
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'quota_rate_schedules'
        AND COLUMN_NAME = 'rate_name'
    ) THEN
        ALTER TABLE quota_rate_schedules
            ADD COLUMN rate_name VARCHAR(255) DEFAULT NULL AFTER id;
    END IF;
END //
DELIMITER ;

CALL _migrate_rate_name();
DROP PROCEDURE IF EXISTS _migrate_rate_name;
