-- Complete setup script for waiting basket automation
-- This script creates both events:
-- 1. Move expired customers to waiting basket (every hour)
-- 2. Release customers from waiting basket after 30 days (every hour)
--
-- Usage:
--   mysql -u root -p mini_erp < setup_waiting_basket_events.sql
--
-- Or execute in MySQL client:
--   source setup_waiting_basket_events.sql

USE `mini_erp`;

-- Enable event scheduler (requires SUPER privilege)
-- Uncomment the line below if you have SUPER privilege
-- SET GLOBAL event_scheduler = ON;

-- Check if event scheduler is enabled
SELECT @@event_scheduler AS event_scheduler_status;

-- ============================================================
-- Event 1: Move expired customers to waiting basket
-- ============================================================
DROP EVENT IF EXISTS `evt_move_expired_to_waiting_basket`;

DELIMITER $$

CREATE EVENT `evt_move_expired_to_waiting_basket`
ON SCHEDULE EVERY 1 HOUR
STARTS CURRENT_TIMESTAMP
ON COMPLETION PRESERVE
ENABLE
COMMENT 'Automatically move expired customers to waiting basket'
DO
BEGIN
    -- Move expired customers into waiting basket
    UPDATE customers
    SET is_in_waiting_basket = 1,
        waiting_basket_start_date = NOW()
    WHERE COALESCE(is_blocked, 0) = 0
      AND COALESCE(is_in_waiting_basket, 0) = 0
      AND ownership_expires IS NOT NULL
      AND ownership_expires <= NOW();
END$$

DELIMITER ;

-- ============================================================
-- Event 2: Release customers from waiting basket after 30 days
-- ============================================================
DROP EVENT IF EXISTS `evt_release_from_waiting_basket`;

DELIMITER $$

CREATE EVENT `evt_release_from_waiting_basket`
ON SCHEDULE EVERY 1 HOUR
STARTS CURRENT_TIMESTAMP
ON COMPLETION PRESERVE
ENABLE
COMMENT 'Release customers from waiting basket after 30 days'
DO
BEGIN
    -- Release customers that have been waiting for >= 30 days back to ready
    UPDATE customers
    SET is_in_waiting_basket = 0,
        waiting_basket_start_date = NULL,
        ownership_expires = DATE_ADD(NOW(), INTERVAL 30 DAY),
        lifecycle_status = 'DailyDistribution',
        follow_up_count = 0,
        followup_bonus_remaining = 1,
        assigned_to = NULL
    WHERE COALESCE(is_in_waiting_basket, 0) = 1
      AND waiting_basket_start_date IS NOT NULL
      AND TIMESTAMPDIFF(DAY, waiting_basket_start_date, NOW()) >= 30
      AND COALESCE(is_blocked, 0) = 0;
END$$

DELIMITER ;

-- ============================================================
-- Verify events were created
-- ============================================================
SELECT 
    EVENT_NAME,
    EVENT_DEFINITION,
    INTERVAL_VALUE,
    INTERVAL_FIELD,
    STATUS,
    LAST_EXECUTED,
    NEXT_EXECUTION_TIME,
    CREATED,
    LAST_ALTERED
FROM INFORMATION_SCHEMA.EVENTS
WHERE EVENT_SCHEMA = DATABASE()
  AND EVENT_NAME IN ('evt_move_expired_to_waiting_basket', 'evt_release_from_waiting_basket')
ORDER BY EVENT_NAME;

-- Show summary
SELECT 
    'Events created successfully!' AS message,
    COUNT(*) AS total_events
FROM INFORMATION_SCHEMA.EVENTS
WHERE EVENT_SCHEMA = DATABASE()
  AND EVENT_NAME IN ('evt_move_expired_to_waiting_basket', 'evt_release_from_waiting_basket');

