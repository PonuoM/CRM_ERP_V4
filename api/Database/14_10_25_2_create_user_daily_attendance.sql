-- Migration: Create daily attendance tracking from login history
-- Purpose: Track per-user daily attendance (Telesale/Supervisor Telesale)
-- Logic:
--   - Work window: 09:00:00 to 18:00:00 each day (9 hours = 32400 seconds)
--   - Sum only the overlap between login sessions and the work window
--   - Attendance value:
--       >= 80% of window -> 1.0 (full)
--       >= 40% and <80% -> 0.5 (half)
--       otherwise        -> 0.0 (absent)
-- Safe for repeated runs (guards on existence)

USE `mini_erp`;

-- 1) Create table if not exists
CREATE TABLE IF NOT EXISTS `user_daily_attendance` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `work_date` DATE NOT NULL,
  `first_login` DATETIME NULL,
  `last_logout` DATETIME NULL,
  `login_sessions` INT NOT NULL DEFAULT 0,
  `effective_seconds` INT NOT NULL DEFAULT 0 COMMENT 'Seconds overlapped with 09:00-18:00',
  `percent_of_workday` DECIMAL(5,2) GENERATED ALWAYS AS (ROUND((`effective_seconds` / 32400) * 100, 2)) STORED,
  `attendance_value` DECIMAL(3,1) NOT NULL DEFAULT 0.0 COMMENT '0.0, 0.5, 1.0',
  `attendance_status` ENUM('absent','half','full') NOT NULL DEFAULT 'absent',
  `computed_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_user_date` (`user_id`, `work_date`),
  KEY `idx_work_date` (`work_date`),
  CONSTRAINT `fk_attendance_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2) Helper procedure: upsert attendance for a single user and date
DROP PROCEDURE IF EXISTS `sp_upsert_user_daily_attendance`;
DELIMITER $$
CREATE PROCEDURE `sp_upsert_user_daily_attendance`(IN p_user_id INT, IN p_date DATE)
proc: BEGIN
  DECLARE v_role VARCHAR(64);
  DECLARE v_work_start DATETIME;
  DECLARE v_work_end DATETIME;
  DECLARE v_first_login DATETIME;
  DECLARE v_last_logout DATETIME;
  DECLARE v_sessions INT DEFAULT 0;
  DECLARE v_effective_seconds INT DEFAULT 0;
  DECLARE v_att_val DECIMAL(3,1) DEFAULT 0.0;
  DECLARE v_att_status VARCHAR(10);

  -- Only consider Telesale roles
  SELECT role INTO v_role FROM users WHERE id = p_user_id LIMIT 1;
  IF v_role IS NULL OR v_role NOT IN ('Telesale','Supervisor Telesale') THEN
    LEAVE proc;
  END IF;

  -- Work window boundaries for the day
  SET v_work_start = TIMESTAMP(p_date, '09:00:00');
  SET v_work_end   = TIMESTAMP(p_date, '18:00:00');

  -- First login within the day
  SELECT MIN(h.login_time)
    INTO v_first_login
    FROM user_login_history h
   WHERE h.user_id = p_user_id
     AND h.login_time >= p_date
     AND h.login_time < DATE_ADD(p_date, INTERVAL 1 DAY);

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

  -- Sum effective seconds overlapping [09:00, 18:00]
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

  -- Attendance value and status
  IF v_effective_seconds >= 0.80 * 32400 THEN
    SET v_att_val = 1.0; SET v_att_status = 'full';
  ELSEIF v_effective_seconds >= 0.40 * 32400 THEN
    SET v_att_val = 0.5; SET v_att_status = 'half';
  ELSE
    SET v_att_val = 0.0; SET v_att_status = 'absent';
  END IF;

  -- Upsert row
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

-- 3) Procedure: compute attendance for all eligible users for a given date
DROP PROCEDURE IF EXISTS `sp_compute_daily_attendance`;
DELIMITER $$
CREATE PROCEDURE `sp_compute_daily_attendance`(IN p_date DATE)
BEGIN
  DECLARE done INT DEFAULT 0;
  DECLARE v_user_id INT;
  DECLARE cur CURSOR FOR
    SELECT id FROM users 
     WHERE status = 'active' AND role IN ('Telesale','Supervisor Telesale');
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = 1;

  OPEN cur;
  read_loop: LOOP
    FETCH cur INTO v_user_id;
    IF done = 1 THEN LEAVE read_loop; END IF;
    CALL sp_upsert_user_daily_attendance(v_user_id, p_date);
  END LOOP;
  CLOSE cur;
END $$
DELIMITER ;

-- 4) Convenience procedure: fill a date range (inclusive)
DROP PROCEDURE IF EXISTS `sp_fill_attendance_for_range`;
DELIMITER $$
CREATE PROCEDURE `sp_fill_attendance_for_range`(IN p_start DATE, IN p_end DATE)
BEGIN
  DECLARE d DATE;
  SET d = p_start;
  WHILE d <= p_end DO
    CALL sp_compute_daily_attendance(d);
    SET d = DATE_ADD(d, INTERVAL 1 DAY);
  END WHILE;
END $$
DELIMITER ;

-- 5) Triggers to keep attendance up-to-date when login history changes
-- Note: Triggers will update the record for the login day only
DROP TRIGGER IF EXISTS `trg_login_history_ai`;
DELIMITER $$
CREATE TRIGGER `trg_login_history_ai` AFTER INSERT ON `user_login_history`
FOR EACH ROW
BEGIN
  CALL sp_upsert_user_daily_attendance(NEW.user_id, DATE(NEW.login_time));
END $$
DELIMITER ;

DROP TRIGGER IF EXISTS `trg_login_history_au`;
DELIMITER $$
CREATE TRIGGER `trg_login_history_au` AFTER UPDATE ON `user_login_history`
FOR EACH ROW
BEGIN
  -- Recompute for both old and new dates just in case
  CALL sp_upsert_user_daily_attendance(NEW.user_id, DATE(NEW.login_time));
  IF DATE(OLD.login_time) <> DATE(NEW.login_time) THEN
    CALL sp_upsert_user_daily_attendance(NEW.user_id, DATE(OLD.login_time));
  END IF;
END $$
DELIMITER ;

-- 6) View for easy reporting (telesale roles only)
DROP VIEW IF EXISTS `v_user_daily_attendance`;
CREATE VIEW `v_user_daily_attendance` AS
SELECT 
  a.id,
  a.user_id,
  u.username,
  CONCAT(u.first_name, ' ', u.last_name) AS full_name,
  u.role,
  a.work_date,
  a.first_login,
  a.last_logout,
  a.login_sessions,
  a.effective_seconds,
  ROUND(a.effective_seconds/3600, 2) AS effective_hours,
  a.percent_of_workday,
  a.attendance_value,
  a.attendance_status,
  a.computed_at,
  a.updated_at
FROM user_daily_attendance a
JOIN users u ON u.id = a.user_id
WHERE u.role IN ('Telesale','Supervisor Telesale');

-- 7) View with daily call minutes (for per-day KPI and later averaging)
DROP VIEW IF EXISTS `v_user_daily_kpis`;
CREATE VIEW `v_user_daily_kpis` AS
SELECT 
  a.user_id,
  u.username,
  CONCAT(u.first_name, ' ', u.last_name) AS full_name,
  u.role,
  a.work_date,
  a.attendance_value,
  a.attendance_status,
  a.effective_seconds,
  ROUND(COALESCE(SUM(ch.duration), 0) / 60, 2) AS call_minutes
FROM user_daily_attendance a
JOIN users u ON u.id = a.user_id
LEFT JOIN call_history ch
  ON DATE(ch.`date`) = a.work_date
 AND ch.caller = CONCAT(u.first_name, ' ', u.last_name)
WHERE u.role IN ('Telesale','Supervisor Telesale')
GROUP BY a.id;
