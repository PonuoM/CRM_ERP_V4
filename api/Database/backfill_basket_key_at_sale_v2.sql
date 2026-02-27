-- ============================================================
-- Backfill basket_key_at_sale สำหรับ order_items ที่มี distribution basket keys (41-45)
-- ============================================================
-- วิธีใช้: 
--   1. รัน Step 1 (สรุป) ก่อนเพื่อดูจำนวนที่ต้องแก้
--   2. รีวิวผลลัพธ์
--   3. Uncomment + รัน Step 2 & 3 (แก้ไข) เมื่อพร้อม
-- ============================================================


-- ============================================================
-- STEP 1: สรุปจำนวนแยกตาม basket + customer_type (เร็วมาก)
-- ไม่ JOIN customers → ใช้แค่ order_items + orders
-- ============================================================

SELECT 
    oi.basket_key_at_sale,
    o.customer_type,
    COUNT(*) AS item_count,
    COALESCE(SUM(oi.net_total), 0) AS total_revenue,
    CASE 
        WHEN o.customer_type = 'New Customer' THEN 38
        WHEN o.customer_type = 'Reorder Customer' THEN 39
        WHEN o.customer_type = 'Mined Lead' THEN 49
        WHEN o.customer_type = 'Upsell' THEN 51
        ELSE 38
    END AS will_map_to
FROM order_items oi
JOIN orders o ON o.id = oi.parent_order_id
WHERE oi.basket_key_at_sale IN (41, 42, 43, 44, 45)
GROUP BY oi.basket_key_at_sale, o.customer_type
ORDER BY oi.basket_key_at_sale, o.customer_type;


-- ============================================================
-- STEP 1b: สรุปจำนวนใน orders table
-- ============================================================

SELECT 
    basket_key_at_sale,
    customer_type,
    COUNT(*) AS order_count
FROM orders
WHERE basket_key_at_sale IN (41, 42, 43, 44, 45)
GROUP BY basket_key_at_sale, customer_type
ORDER BY basket_key_at_sale, customer_type;


-- ============================================================
-- STEP 2: แก้ไข order_items
-- ⚠️ Uncomment แล้วรัน หลังตรวจสอบ Step 1 แล้ว
-- ============================================================

/*
UPDATE order_items oi
JOIN orders o ON o.id = oi.parent_order_id
SET oi.basket_key_at_sale = CASE 
    WHEN o.customer_type = 'New Customer' THEN 38
    WHEN o.customer_type = 'Reorder Customer' THEN 39
    WHEN o.customer_type = 'Mined Lead' THEN 49
    WHEN o.customer_type = 'Upsell' THEN 51
    ELSE 38
END
WHERE oi.basket_key_at_sale IN (41, 42, 43, 44, 45);
*/


-- ============================================================
-- STEP 3: แก้ไข orders table
-- ⚠️ Uncomment แล้วรัน หลังตรวจสอบ Step 1b แล้ว
-- ============================================================

/*
UPDATE orders
SET basket_key_at_sale = CASE 
    WHEN customer_type = 'New Customer' THEN 38
    WHEN customer_type = 'Reorder Customer' THEN 39
    WHEN customer_type = 'Mined Lead' THEN 49
    WHEN customer_type = 'Upsell' THEN 51
    ELSE 38
END
WHERE basket_key_at_sale IN (41, 42, 43, 44, 45);
*/


-- ============================================================
-- STEP 4: ตรวจ NULL basket_key_at_sale (ถ้ามี)
-- ============================================================

SELECT 
    oi.basket_key_at_sale,
    o.customer_type,
    COUNT(*) AS item_count
FROM order_items oi
JOIN orders o ON o.id = oi.parent_order_id
WHERE oi.basket_key_at_sale IS NULL
GROUP BY o.customer_type;
