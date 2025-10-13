-- Add status column to products table
-- Run this script to add the status column to the existing products table

-- Check if column exists first (optional)
-- SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'products' AND COLUMN_NAME = 'status';

-- Add status column to products table
ALTER TABLE `products` ADD COLUMN `status` ENUM('Active', 'Inactive') NOT NULL DEFAULT 'Active' AFTER `company_id`;

-- Update existing products to have Active status (in case there are any NULL values)
UPDATE `products` SET `status` = 'Active' WHERE `status` IS NULL OR `status` = '';

-- Fix product_lots status values (optional, if you want to fix empty status values)
UPDATE `product_lots` SET `status` = 'Active' WHERE `status` = '' OR `status` IS NULL;

-- Show the result (optional)
SELECT id, name, status FROM products LIMIT 10;
