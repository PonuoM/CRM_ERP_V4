-- Drop Foreign Key constraint on sales_channel_page_id
-- This allows orders to have any value without checking if the page exists

-- First, find the FK constraint name (usually 'fk_orders_page')
-- Then drop it

ALTER TABLE orders DROP FOREIGN KEY fk_orders_page;

-- Verify the constraint was dropped
-- SHOW CREATE TABLE orders;
