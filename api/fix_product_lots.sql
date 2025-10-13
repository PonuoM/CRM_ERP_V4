-- แก้ไขปัญหาความไม่สัมพันธ์กันระหว่างตาราง products, product_lots และ warehouse_stocks
-- สร้างข้อมูล product_lots จากข้อมูลใน warehouse_stocks

-- สร้างข้อมูล product_lots จาก warehouse_stocks
INSERT INTO `product_lots` (
    `lot_number`,
    `product_id`,
    `warehouse_id`,
    `purchase_date`,
    `expiry_date`,
    `quantity_received`,
    `quantity_remaining`,
    `unit_cost`,
    `status`,
    `created_at`,
    `updated_at`
)
SELECT 
    ws.lot_number,
    ws.product_id,
    ws.warehouse_id,
    CURDATE() as purchase_date,
    ws.expiry_date,
    ws.quantity as quantity_received,
    ws.quantity as quantity_remaining,
    ws.purchase_price as unit_cost,
    'Active' as status,
    NOW() as created_at,
    NOW() as updated_at
FROM `warehouse_stocks` ws
WHERE ws.lot_number IS NOT NULL AND ws.lot_number != ''
ON DUPLICATE KEY UPDATE
    `quantity_remaining` = VALUES(`quantity_remaining`),
    `unit_cost` = VALUES(`unit_cost`),
    `expiry_date` = VALUES(`expiry_date`),
    `updated_at` = NOW();

-- อัปเดตข้อมูลใน warehouse_stocks ให้มี foreign key ไปยัง product_lots
-- (เพิ่มคอลัมน์ product_lot_id ถ้าจำเป็นต้อง)
ALTER TABLE `warehouse_stocks` 
ADD COLUMN `product_lot_id` INT NULL AFTER `lot_number`;

-- อัปเดต product_lot_id ให้ชี้ไปยัง product_lots
UPDATE `warehouse_stocks` ws
SET `product_lot_id` = (
    SELECT pl.id 
    FROM `product_lots` pl 
    WHERE pl.product_id = ws.product_id 
    AND pl.warehouse_id = ws.warehouse_id 
    AND pl.lot_number = ws.lot_number
    LIMIT 1
)
WHERE ws.lot_number IS NOT NULL AND ws.lot_number != '';

-- เพิ่ม foreign key constraint (ถ้าต้องการ)
-- ALTER TABLE `warehouse_stocks` 
-- ADD CONSTRAINT `fk_warehouse_stocks_product_lot` 
-- FOREIGN KEY (`product_lot_id`) REFERENCES `product_lots`(`id`) ON DELETE SET NULL;

-- แสดงผลลัพธ์
SELECT 'Products:' as table_name, COUNT(*) as count FROM products;
SELECT 'Product Lots:' as table_name, COUNT(*) as count FROM product_lots;
SELECT 'Warehouse Stocks with Lots:' as table_name, COUNT(*) as count FROM warehouse_stocks WHERE lot_number IS NOT NULL AND lot_number != '';
SELECT 'Warehouse Stocks with product_lot_id:' as table_name, COUNT(*) as count FROM warehouse_stocks WHERE product_lot_id IS NOT NULL;

-- Add status column to products table
ALTER TABLE `products` ADD COLUMN `status` ENUM('Active', 'Inactive') NOT NULL DEFAULT 'Active' AFTER `company_id`;

-- Update existing products to have Active status
UPDATE `products` SET `status` = 'Active' WHERE `status` IS NULL OR `status` = '';

-- Fix product_lots status values
UPDATE `product_lots` SET `status` = 'Active' WHERE `status` = '' OR `status` IS NULL;