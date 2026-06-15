ALTER TABLE orders 
ADD COLUMN coupon_discount DECIMAL(12, 2) DEFAULT 0.00 AFTER bill_discount;
