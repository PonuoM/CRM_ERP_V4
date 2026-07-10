-- Remove monthly_discount from orders and add it to order_items
ALTER TABLE orders DROP COLUMN monthly_discount;
ALTER TABLE order_items ADD COLUMN monthly_discount DECIMAL(12, 2) DEFAULT 0.00 AFTER discount;
