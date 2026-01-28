-- Debug upsell_exit_handler query
-- Run this on production to check why customer is not being picked up

-- 1. Check the customer data
SELECT 
    c.customer_id, 
    c.first_name,
    c.last_name,
    c.phone,
    c.current_basket_key,
    c.assigned_to,
    c.company_id
FROM customers c
WHERE c.current_basket_key = 53
  AND (c.assigned_to IS NULL OR c.assigned_to = 0)
ORDER BY c.customer_id DESC
LIMIT 10;

-- 2. Check orders for those customers (last 7 days)
SELECT 
    c.customer_id,
    c.first_name,
    c.current_basket_key,
    c.assigned_to,
    o.id as order_id,
    o.order_status,
    o.order_date,
    o.creator_id,
    u.role_id as creator_role,
    DATEDIFF(NOW(), o.order_date) as days_ago
FROM customers c
INNER JOIN orders o ON o.customer_id = c.customer_id
INNER JOIN users u ON o.creator_id = u.id
WHERE c.current_basket_key = 53
  AND (c.assigned_to IS NULL OR c.assigned_to = 0)
  AND o.order_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)
ORDER BY c.customer_id DESC, o.order_date DESC
LIMIT 20;

-- 3. Full check matching the cron job query (company_id = 1)
SELECT DISTINCT 
    c.customer_id, 
    c.first_name,
    c.last_name,
    c.phone,
    c.current_basket_key,
    c.assigned_to,
    o.order_status, 
    o.id as order_id,
    o.order_date,
    u.role_id as creator_role,
    DATEDIFF(NOW(), o.order_date) as days_ago
FROM customers c
INNER JOIN orders o ON o.customer_id = c.customer_id
INNER JOIN users u ON o.creator_id = u.id
WHERE c.company_id = 1
  AND (c.assigned_to IS NULL OR c.assigned_to = 0)
  AND o.order_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)
  AND u.role_id NOT IN (6, 7)
  AND o.order_status = 'Picking'
  AND (c.current_basket_key = 53 OR c.current_basket_key IS NULL OR c.current_basket_key = 0)
ORDER BY o.order_date DESC;

-- 4. Check if ORDER JOIN is the problem (customer_id type mismatch?)
-- Sometimes orders.customer_id is VARCHAR while customers.customer_id is INT
SELECT 
    DATA_TYPE, 
    COLUMN_NAME,
    TABLE_NAME
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE()
  AND COLUMN_NAME = 'customer_id' 
  AND TABLE_NAME IN ('customers', 'orders');

-- 5. Check sample orders to see customer_id format
SELECT id, customer_id, order_status, order_date
FROM orders 
WHERE order_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)
  AND order_status = 'Picking'
ORDER BY order_date DESC
LIMIT 10;
