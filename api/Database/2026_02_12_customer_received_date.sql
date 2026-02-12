-- Add customer_received_date to orders table
-- วันที่ลูกค้ารับสินค้าจริง (บันทึกจากหน้าติดตามหนี้)
ALTER TABLE orders ADD COLUMN customer_received_date DATE NULL DEFAULT NULL AFTER delivery_date;
