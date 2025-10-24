-- คัดลอกและรัน SQL นี้ใน phpMyAdmin
UPDATE customers c
SET 
    first_order_date = (
        SELECT MIN(order_date) 
        FROM orders o 
        WHERE o.customer_id = c.id 
        AND o.order_status != 'Cancelled'
    ),
    last_order_date = (
        SELECT MAX(order_date) 
        FROM orders o 
        WHERE o.customer_id = c.id 
        AND o.order_status != 'Cancelled'
    ),
    order_count = (
        SELECT COUNT(*) 
        FROM orders o 
        WHERE o.customer_id = c.id 
        AND o.order_status != 'Cancelled'
    ),
    is_new_customer = (
        SELECT COUNT(*) = 1 
        FROM orders o 
        WHERE o.customer_id = c.id 
        AND o.order_status != 'Cancelled'
    ),
    is_repeat_customer = (
        SELECT COUNT(*) > 1 
        FROM orders o 
        WHERE o.customer_id = c.id 
        AND o.order_status != 'Cancelled'
    )
WHERE EXISTS (
    SELECT 1 FROM orders o WHERE o.customer_id = c.id
);