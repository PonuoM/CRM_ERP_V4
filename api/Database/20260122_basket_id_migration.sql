-- ==========================================
-- Change current_basket_key to store basket_config.id
-- Date: 2026-01-22
-- ==========================================

-- Step 1: Update existing data - convert basket_key to basket_config.id
UPDATE customers c
JOIN basket_config bc ON c.current_basket_key = bc.basket_key AND c.company_id = bc.company_id
SET c.current_basket_key = CAST(bc.id AS CHAR(50))
WHERE c.current_basket_key IS NOT NULL 
  AND c.current_basket_key NOT REGEXP '^[0-9]+$';  -- Only update non-numeric values

-- Step 2: Verify - show sample data
SELECT 
    c.customer_id, c.first_name, c.current_basket_key as basket_id,
    bc.basket_key, bc.basket_name
FROM customers c
LEFT JOIN basket_config bc ON c.current_basket_key = CAST(bc.id AS CHAR(50))
WHERE c.current_basket_key IS NOT NULL
LIMIT 10;
