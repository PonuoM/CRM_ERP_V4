-- =============================================
-- Backfill basket_key_at_sale for Orders & Order Items
-- Since: 2026-01-01
-- Logic: Use customer's current_basket_key as fallback
-- Only update records where basket_key_at_sale IS NULL
-- =============================================

-- Step 1: Check how many records need updating
SELECT 
    'orders' AS table_name,
    COUNT(*) AS total_orders_since_jan2026,
    SUM(CASE WHEN basket_key_at_sale IS NULL THEN 1 ELSE 0 END) AS needs_update
FROM orders 
WHERE order_date >= '2026-01-01'
UNION ALL
SELECT 
    'order_items' AS table_name,
    COUNT(*) AS total_items_since_jan2026,
    SUM(CASE WHEN oi.basket_key_at_sale IS NULL THEN 1 ELSE 0 END) AS needs_update
FROM order_items oi
JOIN orders o ON oi.parent_order_id = o.id
WHERE o.order_date >= '2026-01-01';

-- =============================================
-- Step 1.5: PREVIEW - View data BEFORE update (Run this first!)
-- =============================================

-- Preview: Orders that will be updated
SELECT 
    o.id AS order_id,
    o.order_date,
    o.customer_id,
    o.basket_key_at_sale AS current_value_NULL,
    c.current_basket_key AS will_be_set_to
FROM orders o
JOIN customers c ON o.customer_id = c.customer_id
WHERE o.order_date >= '2026-01-01'
  AND o.basket_key_at_sale IS NULL
  AND c.current_basket_key IS NOT NULL
ORDER BY o.order_date DESC
LIMIT 50;

-- Preview: Order items that will be updated
SELECT 
    oi.id AS item_id,
    o.id AS order_id,
    o.order_date,
    o.customer_id,
    oi.basket_key_at_sale AS current_value_NULL,
    c.current_basket_key AS will_be_set_to
FROM order_items oi
JOIN orders o ON oi.parent_order_id = o.id
JOIN customers c ON o.customer_id = c.customer_id
WHERE o.order_date >= '2026-01-01'
  AND oi.basket_key_at_sale IS NULL
  AND c.current_basket_key IS NOT NULL
ORDER BY o.order_date DESC
LIMIT 50;

-- =============================================
-- Step 2: Update orders table
-- =============================================
UPDATE orders o
JOIN customers c ON o.customer_id = c.customer_id
SET o.basket_key_at_sale = c.current_basket_key
WHERE o.order_date >= '2026-01-01'
  AND o.basket_key_at_sale IS NULL
  AND c.current_basket_key IS NOT NULL;

-- Check result
SELECT 'Orders updated' AS status, ROW_COUNT() AS rows_affected;

-- =============================================
-- Step 3: Update order_items table
-- =============================================
UPDATE order_items oi
JOIN orders o ON oi.parent_order_id = o.id
JOIN customers c ON o.customer_id = c.customer_id
SET oi.basket_key_at_sale = c.current_basket_key
WHERE o.order_date >= '2026-01-01'
  AND oi.basket_key_at_sale IS NULL
  AND c.current_basket_key IS NOT NULL;

-- Check result
SELECT 'Order items updated' AS status, ROW_COUNT() AS rows_affected;

-- =============================================
-- Step 4: Verify results
-- =============================================
SELECT 
    'orders' AS table_name,
    COUNT(*) AS total,
    SUM(CASE WHEN basket_key_at_sale IS NULL THEN 1 ELSE 0 END) AS still_null,
    SUM(CASE WHEN basket_key_at_sale IS NOT NULL THEN 1 ELSE 0 END) AS has_value
FROM orders 
WHERE order_date >= '2026-01-01'
UNION ALL
SELECT 
    'order_items' AS table_name,
    COUNT(*) AS total,
    SUM(CASE WHEN oi.basket_key_at_sale IS NULL THEN 1 ELSE 0 END) AS still_null,
    SUM(CASE WHEN oi.basket_key_at_sale IS NOT NULL THEN 1 ELSE 0 END) AS has_value
FROM order_items oi
JOIN orders o ON oi.parent_order_id = o.id
WHERE o.order_date >= '2026-01-01';

-- =============================================
-- OPTIONAL: Sample check - show some updated records
-- =============================================
SELECT 
    o.id AS order_id,
    o.order_date,
    o.customer_id,
    c.name AS customer_name,
    c.current_basket_key,
    o.basket_key_at_sale AS order_basket_key,
    b.name AS basket_name
FROM orders o
JOIN customers c ON o.customer_id = c.customer_id
LEFT JOIN baskets b ON o.basket_key_at_sale = b.basket_key
WHERE o.order_date >= '2026-01-01'
ORDER BY o.order_date DESC
LIMIT 20;
