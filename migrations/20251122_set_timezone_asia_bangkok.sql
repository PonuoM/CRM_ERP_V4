-- Migration: Set MySQL timezone to Asia/Bangkok (UTC+7)
-- This ensures all datetime operations use Thailand timezone

-- Set session timezone (for current connection)
SET time_zone = '+07:00';

-- Note: To set global timezone (requires SUPER privilege), run:
-- SET GLOBAL time_zone = '+07:00';
-- 
-- Or update my.cnf / my.ini:
-- [mysqld]
-- default-time-zone = '+07:00'

-- Verify timezone setting
SELECT @@global.time_zone, @@session.time_zone, NOW() as current_datetime;

