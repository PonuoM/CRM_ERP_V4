-- เพิ่มฟิลด์สำหรับติดตามการซื้อ
ALTER TABLE customers 
ADD COLUMN first_order_date DATETIME NULL,
ADD COLUMN last_order_date DATETIME NULL,
ADD COLUMN order_count INT DEFAULT 0,
ADD COLUMN is_new_customer BOOLEAN DEFAULT FALSE,
ADD COLUMN is_repeat_customer BOOLEAN DEFAULT FALSE;