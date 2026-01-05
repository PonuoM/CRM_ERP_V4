-- View: v_recently_turned_waiting
-- Description: Shows customers who were moved to the waiting basket in the last 24 hours.
-- These are the customers whose ownership expired and were reclaimed by the system.

CREATE OR REPLACE VIEW v_recently_turned_waiting AS
SELECT 
    c.id, 
    c.customer_id, 
    c.first_name, 
    c.last_name, 
    c.phone,
    c.waiting_basket_start_date as moved_to_waiting_at,
    c.ownership_expires as was_expired_at,
    -- If available, show who it was assigned to before (requires history table join, omitted for simplicity)
    c.updated_at
FROM customers c
WHERE c.is_in_waiting_basket = 1
  AND c.waiting_basket_start_date >= NOW() - INTERVAL 24 HOUR
ORDER BY c.waiting_basket_start_date DESC;

-- Usage:
-- SELECT * FROM v_recently_turned_waiting;
