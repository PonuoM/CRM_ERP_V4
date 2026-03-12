-- ============================================================
-- Add new columns for SO page restructure
-- Date: 2026-03-11
-- ============================================================

-- inv2_stock_orders: new header fields
ALTER TABLE inv2_stock_orders
  ADD COLUMN source_location VARCHAR(255) NULL COMMENT 'จากสถานที่ผลิต' AFTER so_number,
  ADD COLUMN customer_vendor VARCHAR(255) NULL COMMENT 'ลูกค้า/ผู้ขาย' AFTER source_location,
  ADD COLUMN delivery_location VARCHAR(255) NULL COMMENT 'สถานที่จัดส่ง' AFTER expected_date;

-- inv2_stock_order_items: new line item fields
ALTER TABLE inv2_stock_order_items
  ADD COLUMN department VARCHAR(255) NULL COMMENT 'ฝ่ายผลิต' AFTER quantity,
  ADD COLUMN delivery_date DATE NULL COMMENT 'วันที่ส่งมอบ (per item)' AFTER department;
