-- MySQL Event: Auto-move expired customers to waiting basket
-- This event runs every hour to check for expired customers and move them to waiting basket
-- 
-- Requirements:
-- 1. MySQL Event Scheduler must be enabled: SET GLOBAL event_scheduler = ON;
-- 2. User must have EVENT privilege
--
-- To check if event scheduler is enabled:
--   SHOW VARIABLES LIKE 'event_scheduler';
--
-- To enable event scheduler (requires SUPER privilege):
--   SET GLOBAL event_scheduler = ON;
--
-- To view all events:
--   SHOW EVENTS;
--
-- To drop this event:
--   DROP EVENT IF EXISTS evt_move_expired_to_waiting_basket;

USE `mini_erp`;

-- Drop existing event if it exists
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
        waiting_basket_start_date = NOW(),
        lifecycle_status = 'FollowUp'
    WHERE COALESCE(is_blocked, 0) = 0
      AND COALESCE(is_in_waiting_basket, 0) = 0
      AND ownership_expires IS NOT NULL
      AND ownership_expires <= NOW();
    
    -- Optional: Log the number of affected rows (uncomment if needed)
    -- SET @affected_rows = ROW_COUNT();
    -- INSERT INTO event_logs (event_name, affected_rows, executed_at) 
    -- VALUES ('evt_move_expired_to_waiting_basket', @affected_rows, NOW());
END$$

DELIMITER ;

-- Verify the event was created
SELECT 
    EVENT_NAME,
    EVENT_DEFINITION,
    INTERVAL_VALUE,
    INTERVAL_FIELD,
    STATUS,
    LAST_EXECUTED,
    NEXT_EXECUTION_TIME
FROM INFORMATION_SCHEMA.EVENTS
WHERE EVENT_SCHEMA = DATABASE()
  AND EVENT_NAME = 'evt_move_expired_to_waiting_basket';

