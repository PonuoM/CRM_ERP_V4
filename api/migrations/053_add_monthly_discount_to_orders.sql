-- Add monthly_discount column for informational reference
ALTER TABLE orders
ADD COLUMN monthly_discount DECIMAL(12, 2) DEFAULT 0.00 AFTER coupon_discount;
