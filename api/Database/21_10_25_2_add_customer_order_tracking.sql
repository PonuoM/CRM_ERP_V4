-- เพิ่มฟิลด์สำหรับติดตามการซื้อของลูกค้า
-- เพื่อแก้ปัญหาการแชร์รายชื่อลูกค้าใหม่

ALTER TABLE customers 
ADD COLUMN first_order_date DATETIME NULL COMMENT 'วันที่ซื้อครั้งแรก',
ADD COLUMN last_order_date DATETIME NULL COMMENT 'วันที่ซื้อล่าสุด',
ADD COLUMN order_count INT DEFAULT 0 COMMENT 'จำนวนครั้งที่ซื้อ',
ADD COLUMN is_new_customer BOOLEAN DEFAULT FALSE COMMENT 'เป็นลูกค้าใหม่หรือไม่',
ADD COLUMN is_repeat_customer BOOLEAN DEFAULT FALSE COMMENT 'เป็นลูกค้ากลับมาซื้อหรือไม่';

-- สร้าง index เพื่อเพิ่มประสิทธิภาพการค้นหา
CREATE INDEX idx_customers_first_order_date ON customers(first_order_date);
CREATE INDEX idx_customers_last_order_date ON customers(last_order_date);
CREATE INDEX idx_customers_order_count ON customers(order_count);
CREATE INDEX idx_customers_is_new_customer ON customers(is_new_customer);
CREATE INDEX idx_customers_is_repeat_customer ON customers(is_repeat_customer);

-- อัปเดตข้อมูลลูกค้าที่มีอยู่แล้วโดยใช้ข้อมูลจาก orders table
UPDATE customers c
SET 
    first_order_date = (
        SELECT MIN(created_at) 
        FROM orders o 
        WHERE o.customer_id = c.id 
        AND o.status != 'Cancelled'
    ),
    last_order_date = (
        SELECT MAX(created_at) 
        FROM orders o 
        WHERE o.customer_id = c.id 
        AND o.status != 'Cancelled'
    ),
    order_count = (
        SELECT COUNT(*) 
        FROM orders o 
        WHERE o.customer_id = c.id 
        AND o.status != 'Cancelled'
    ),
    is_new_customer = (
        SELECT COUNT(*) = 1 
        FROM orders o 
        WHERE o.customer_id = c.id 
        AND o.status != 'Cancelled'
    ),
    is_repeat_customer = (
        SELECT COUNT(*) > 1 
        FROM orders o 
        WHERE o.customer_id = c.id 
        AND o.status != 'Cancelled'
    )
WHERE EXISTS (
    SELECT 1 FROM orders o WHERE o.customer_id = c.id
);
