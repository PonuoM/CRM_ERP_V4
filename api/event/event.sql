-- Run this file via cron with mysql CLI, e.g.:
-- mysql -h <host> -u <user> -p'<pass>' <database> < /path/to/api/event/event.sql

-- 1) Move expired customers to waiting basket
UPDATE customers
SET assigned_to = NULL,
    lifecycle_status = 'Old',
    is_in_waiting_basket = 1,
    waiting_basket_start_date = NOW(),
    followup_bonus_remaining = 1
WHERE ownership_expires IS NOT NULL
  AND ownership_expires <= NOW()
  AND COALESCE(is_in_waiting_basket,0) = 0
  AND COALESCE(is_blocked,0) = 0;

-- 2) Waiting >= 30 days -> ready (Old) with new expiry
UPDATE customers
SET is_in_waiting_basket = 0,
    waiting_basket_start_date = NULL,
    assigned_to = NULL,
    ownership_expires = DATE_ADD(NOW(), INTERVAL 30 DAY),
    lifecycle_status = 'Old',
    follow_up_count = 0,
    followup_bonus_remaining = 1
WHERE ownership_expires IS NOT NULL
  AND NOW() > DATE_ADD(ownership_expires, INTERVAL 30 DAY)
  AND COALESCE(is_in_waiting_basket,0) = 1
  AND COALESCE(is_blocked,0) = 0;

-- 3) Refresh grade by total_purchases
UPDATE customers
SET grade = CASE
    WHEN total_purchases >= 50000 THEN 'A+'
    WHEN total_purchases >= 20000 THEN 'A'
    WHEN total_purchases >= 5000  THEN 'B'
    WHEN total_purchases >= 2000  THEN 'C'
    ELSE 'D'
  END;

