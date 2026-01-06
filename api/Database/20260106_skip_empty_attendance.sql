-- Migration: Update attendance procedure to skip if no login
-- Date: 2026-01-06
-- Purpose: Only create attendance record when user has login history (saves storage)
-- NOTE: Run this on your production database

-- Update procedure to skip if no login history
DROP PROCEDURE IF EXISTS `sp_upsert_user_daily_attendance`;
DELIMITER $$
CREATE PROCEDURE `sp_upsert_user_daily_attendance`(IN p_user_id INT, IN p_date DATE)
proc: BEGIN
  DECLARE v_role VARCHAR(64);
  DECLARE v_status VARCHAR(32);
  DECLARE v_work_start DATETIME;
  DECLARE v_work_end DATETIME;
  DECLARE v_first_login DATETIME;
  DECLARE v_last_logout DATETIME;
  DECLARE v_sessions INT DEFAULT 0;
  DECLARE v_effective_seconds INT DEFAULT 0;
  DECLARE v_effective_for_calc INT DEFAULT 0;
  DECLARE v_att_val DECIMAL(3,1) DEFAULT 0.0;
  DECLARE v_att_status VARCHAR(10);
  DECLARE v_half_threshold INT DEFAULT 7200;
  DECLARE v_full_threshold INT DEFAULT 14400;
  DECLARE v_cap_seconds INT DEFAULT 21600;

  -- Ensure user exists and remains active
  SELECT role, status INTO v_role, v_status FROM users WHERE id = p_user_id LIMIT 1;
  IF v_role IS NULL OR v_status IS NULL OR v_status <> 'active' THEN
    LEAVE proc;
  END IF;

  -- Work window boundaries for the day (full day)
  SET v_work_start = TIMESTAMP(p_date, '00:00:00');
  SET v_work_end   = TIMESTAMP(p_date, '23:59:59');

  -- First login within the day
  SELECT MIN(h.login_time)
    INTO v_first_login
    FROM user_login_history h
   WHERE h.user_id = p_user_id
     AND h.login_time >= p_date
     AND h.login_time < DATE_ADD(p_date, INTERVAL 1 DAY);

  -- *** NEW: Skip if no login history for this day ***
  IF v_first_login IS NULL THEN
    LEAVE proc;
  END IF;

  -- Last logout within or up to end of work window (fallback to NOW() if no logout)
  SELECT MAX(LEAST(COALESCE(h.logout_time, NOW()), v_work_end))
    INTO v_last_logout
    FROM user_login_history h
   WHERE h.user_id = p_user_id
     AND h.login_time >= p_date
     AND h.login_time < DATE_ADD(p_date, INTERVAL 1 DAY);

  -- Number of sessions overlapping work window
  SELECT COUNT(*)
    INTO v_sessions
    FROM user_login_history h
   WHERE h.user_id = p_user_id
     AND h.login_time >= p_date
     AND h.login_time < DATE_ADD(p_date, INTERVAL 1 DAY)
     AND h.login_time < v_work_end
     AND COALESCE(h.logout_time, NOW()) > v_work_start;

  -- Sum effective seconds overlapping the day
  SELECT COALESCE(SUM(
           GREATEST(0, TIMESTAMPDIFF(SECOND,
             GREATEST(h.login_time, v_work_start),
             LEAST(COALESCE(h.logout_time, NOW()), v_work_end)
           ))
         ), 0)
    INTO v_effective_seconds
    FROM user_login_history h
   WHERE h.user_id = p_user_id
     AND h.login_time >= p_date
     AND h.login_time < DATE_ADD(p_date, INTERVAL 1 DAY)
     AND h.login_time < v_work_end
     AND COALESCE(h.logout_time, NOW()) > v_work_start;

  SET v_effective_for_calc = v_effective_seconds;
  IF v_effective_for_calc > v_cap_seconds THEN
    SET v_effective_for_calc = v_cap_seconds;
  END IF;

  -- Attendance value and status
  IF v_effective_for_calc >= v_full_threshold THEN
    SET v_att_val = 1.0; SET v_att_status = 'full';
  ELSEIF v_effective_for_calc >= v_half_threshold THEN
    SET v_att_val = 0.5; SET v_att_status = 'half';
  ELSE
    SET v_att_val = 0.0; SET v_att_status = 'absent';
  END IF;

  -- Upsert row (only if we have login data)
  INSERT INTO user_daily_attendance
    (user_id, work_date, first_login, last_logout, login_sessions, effective_seconds, attendance_value, attendance_status, computed_at)
  VALUES
    (p_user_id, p_date, v_first_login, v_last_logout, v_sessions, v_effective_seconds, v_att_val, v_att_status, NOW())
  ON DUPLICATE KEY UPDATE
    first_login = VALUES(first_login),
    last_logout = VALUES(last_logout),
    login_sessions = VALUES(login_sessions),
    effective_seconds = VALUES(effective_seconds),
    attendance_value = VALUES(attendance_value),
    attendance_status = VALUES(attendance_status),
    computed_at = NOW(),
    updated_at = NOW();

END proc $$
DELIMITER ;

-- Optional: Delete existing NULL records to clean up storage
-- DELETE FROM user_daily_attendance WHERE first_login IS NULL;
