-- =============================================================================
-- Migration: Add basket_key_at_sale to orders and order_items tables
-- Date: 2026-01-25
-- Description: เก็บ basket_key ของลูกค้า ณ ตอนสร้าง order/upsell เพื่อใช้คำนวณ commission
-- =============================================================================

-- =============================================================================
-- PART 1: เพิ่ม column ใน orders table (สำหรับ order ใหม่)
-- =============================================================================
ALTER TABLE `orders`
ADD COLUMN `basket_key_at_sale` VARCHAR(50) NULL 
COMMENT 'ถังที่ลูกค้าอยู่ตอนสร้าง order (สำหรับคำนวณ commission)' 
AFTER `upsell_user_id`;

-- เพิ่ม index สำหรับ query รายงาน commission แยกตาม basket
CREATE INDEX `idx_orders_basket_key` ON `orders` (`basket_key_at_sale`);

-- =============================================================================
-- PART 2: เพิ่ม column ใน order_items table (สำหรับ upsell)
-- =============================================================================
ALTER TABLE `order_items`
ADD COLUMN `basket_key_at_sale` VARCHAR(50) NULL 
COMMENT 'ถังที่ลูกค้าอยู่ตอนเพิ่มสินค้า (สำหรับคำนวณ commission upsell)' 
AFTER `creator_id`;

-- เพิ่ม index สำหรับ query รายงาน commission upsell แยกตาม basket
CREATE INDEX `idx_order_items_basket_key` ON `order_items` (`basket_key_at_sale`);

-- =============================================================================
-- สำหรับ Backfill ข้อมูลเก่า (Optional)
-- =============================================================================
-- UPDATE orders o
-- JOIN customers c ON o.customer_id = c.customer_id
-- SET o.basket_key_at_sale = c.current_basket_key
-- WHERE o.basket_key_at_sale IS NULL;
