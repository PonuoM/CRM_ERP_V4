-- Fill NULL last_order_date from orders table
-- Run daily via cron to handle new/cancelled orders

UPDATE customers c
SET c.last_order_date = (
    SELECT MAX(o.order_date)
    FROM orders o
    WHERE o.customer_id = c.customer_id
    AND o.order_status != 'Cancelled'
)
WHERE c.last_order_date IS NULL
AND EXISTS (
    SELECT 1 FROM orders o2 
    WHERE o2.customer_id = c.customer_id 
    AND o2.order_status != 'Cancelled'
);

-- Also update customers whose last_order_date might be outdated
-- (e.g., if their latest non-cancelled order changed)
UPDATE customers c
SET c.last_order_date = (
    SELECT MAX(o.order_date)
    FROM orders o
    WHERE o.customer_id = c.customer_id
    AND o.order_status != 'Cancelled'
)
WHERE c.last_order_date IS NOT NULL
AND c.last_order_date != (
    SELECT COALESCE(MAX(o.order_date), c.last_order_date)
    FROM orders o
    WHERE o.customer_id = c.customer_id
    AND o.order_status != 'Cancelled'
);
