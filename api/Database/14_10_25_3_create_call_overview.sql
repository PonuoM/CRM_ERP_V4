-- Migration: Monthly call overview per telesale (users + onecall_log + attendance)
-- Purpose: Provide a per-month summary for Telesale/Supervisor Telesale
-- Fields: user, role, phone(0-prefix), working_days(sum of attendance_value),
--         total_minutes (onecall_log.duration/60), connected_calls (duration>=40s),
--         total_calls, minutes_per_workday = total_minutes / working_days
-- Notes: Joins onecall_log.phone_telesale (starts with 66...) to users.phone (starts with 0...)

USE `mini_erp`;

-- 1) Helpful indexes (guarded) ------------------------------------------------

-- Index on onecall_log(phone_telesale, timestamp)
SET @idx := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'onecall_log' AND INDEX_NAME = 'idx_onecall_phone_ts'
);
SET @sql := IF(@idx = 0,
  'CREATE INDEX `idx_onecall_phone_ts` ON `onecall_log` (`phone_telesale`, `timestamp`);',
  'SELECT 1;'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Index on users(phone)
SET @idx := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = 'idx_users_phone'
);
SET @sql := IF(@idx = 0,
  'CREATE INDEX `idx_users_phone` ON `users` (`phone`);',
  'SELECT 1;'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2) Monthly overview view -----------------------------------------------------

DROP VIEW IF EXISTS `v_telesale_call_overview_monthly`;
CREATE VIEW `v_telesale_call_overview_monthly` AS
WITH
  users_ts AS (
    SELECT
      u.id,
      u.first_name,
      u.role,
      CAST(REPLACE(REPLACE(u.phone, '-', ''), ' ', '') AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS phone0
    FROM users u
    WHERE u.role IN ('Telesale','Supervisor Telesale')
  ),
  calls AS (
    SELECT
      uts.id AS user_id,
      DATE_FORMAT(ocl.`timestamp`, '%Y-%m') AS month_key,
      COUNT(*) AS total_calls,
      SUM(CASE WHEN ocl.duration >= 40 THEN 1 ELSE 0 END) AS connected_calls,
      ROUND(SUM(ocl.duration)/60, 2) AS total_minutes
    FROM onecall_log ocl
    JOIN users_ts uts
      ON (
        CAST(CONCAT('0', SUBSTRING(REPLACE(REPLACE(ocl.phone_telesale, '-', ''), ' ', ''), 3)) AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci
      ) = uts.phone0
    GROUP BY uts.id, DATE_FORMAT(ocl.`timestamp`, '%Y-%m')
  ),
  attendance AS (
    SELECT
      uts.id AS user_id,
      DATE_FORMAT(a.work_date, '%Y-%m') AS month_key,
      SUM(a.attendance_value) AS working_days
    FROM user_daily_attendance a
    JOIN users_ts uts ON uts.id = a.user_id
    GROUP BY uts.id, DATE_FORMAT(a.work_date, '%Y-%m')
  ),
  months AS (
    SELECT user_id, month_key FROM calls
    UNION
    SELECT user_id, month_key FROM attendance
  )
SELECT
  m.month_key,
  uts.id AS user_id,
  uts.first_name,
  uts.role,
  uts.phone0 AS phone,
  COALESCE(att.working_days, 0) AS working_days,
  COALESCE(c.total_minutes, 0) AS total_minutes,
  COALESCE(c.connected_calls, 0) AS connected_calls,
  COALESCE(c.total_calls, 0) AS total_calls,
  ROUND(
    COALESCE(c.total_minutes, 0) / NULLIF(COALESCE(att.working_days, 0), 0)
  , 2) AS minutes_per_workday
FROM months m
JOIN users_ts uts ON uts.id = m.user_id
LEFT JOIN calls c ON c.user_id = m.user_id AND c.month_key = m.month_key
LEFT JOIN attendance att ON att.user_id = m.user_id AND att.month_key = m.month_key
ORDER BY m.month_key DESC, uts.id;

-- 3) Convenience procedure to query a given month (YYYY-MM) -------------------
DROP PROCEDURE IF EXISTS `sp_get_telesale_call_overview`;
DELIMITER $$
CREATE PROCEDURE `sp_get_telesale_call_overview`(IN p_month VARCHAR(7))
BEGIN
  IF p_month IS NULL OR p_month = '' THEN
    SELECT * FROM v_telesale_call_overview_monthly;
  ELSE
    SELECT * FROM v_telesale_call_overview_monthly WHERE month_key = p_month;
  END IF;
END $$
DELIMITER ;
