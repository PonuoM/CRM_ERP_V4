-- Migration: 021_add_extended_jst_inventory_fields.sql
-- Description: Add fields for stock health, supplier, and sales velocity

ALTER TABLE jst_inventory
ADD COLUMN defective_qty INT DEFAULT 0 AFTER available_qty,
ADD COLUMN in_qty INT DEFAULT 0 AFTER defective_qty,
ADD COLUMN purchase_qty INT DEFAULT 0 AFTER in_qty,
ADD COLUMN return_qty INT DEFAULT 0 AFTER purchase_qty,
ADD COLUMN brand_name VARCHAR(100) DEFAULT '' AFTER pic,
ADD COLUMN supplier_name VARCHAR(255) DEFAULT '' AFTER brand_name,
ADD COLUMN day_sale_3 INT DEFAULT 0 AFTER supplier_name,
ADD COLUMN day_sale_7 INT DEFAULT 0 AFTER day_sale_3,
ADD COLUMN day_sale_15 INT DEFAULT 0 AFTER day_sale_7,
ADD COLUMN day_sale_30 INT DEFAULT 0 AFTER day_sale_15,
ADD COLUMN day_sale_60 INT DEFAULT 0 AFTER day_sale_30,
ADD COLUMN day_sale_90 INT DEFAULT 0 AFTER day_sale_60;
