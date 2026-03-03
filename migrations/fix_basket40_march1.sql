-- ==============================================
-- ตรวจสอบลูกค้าที่ถูกย้ายจากถัง 40 เมื่อ 1 มี.ค. 2026
-- ==============================================

-- Step 1: ดูรายการทั้งหมดที่ออกจากถัง 40 ในวันที่ 1/03/2026
SELECT 
    btl.id AS log_id,
    btl.customer_id,
    btl.from_basket_key,
    btl.to_basket_key,
    btl.transition_type,
    btl.triggered_by,
    btl.notes,
    btl.created_at,
    c.first_name,
    c.last_name,
    c.assigned_to,
    c.current_basket_key AS current_basket_now,
    c.basket_entered_date
FROM basket_transition_log btl
JOIN customers c ON c.customer_id = btl.customer_id
WHERE btl.from_basket_key = '40'
  AND btl.created_at >= '2026-03-01 00:00:00'
  AND btl.created_at < '2026-03-01 06:00:00'
ORDER BY btl.created_at ASC;

-- Step 2: ดูเฉพาะคนที่ยังมี assigned_to (ถูกแจกไปแล้ว หรือยังค้างอยู่)
SELECT 
    btl.customer_id,
    c.first_name,
    c.last_name,
    c.assigned_to,
    c.current_basket_key AS current_basket_now,
    btl.to_basket_key AS was_moved_to,
    btl.created_at AS moved_at
FROM basket_transition_log btl
JOIN customers c ON c.customer_id = btl.customer_id
WHERE btl.from_basket_key = '40'
  AND btl.created_at >= '2026-03-01 00:00:00'
  AND btl.created_at < '2026-03-01 06:00:00'
  AND c.assigned_to IS NOT NULL
ORDER BY btl.created_at ASC;

-- ==============================================
-- Step 3: ย้ายกลับไปถังพัก (ID 54)
-- ⚠️ รันหลังจากตรวจสอบ Step 2 แล้ว
-- ⚠️ ต้องรัน add_holding_basket.sql ก่อนเพื่อสร้างถัง 54
-- ==============================================

UPDATE customers 
SET 
    current_basket_key = '54',
    basket_entered_date = '2026-03-01 01:00:00',
    assigned_to = NULL
WHERE customer_id IN (
    SELECT btl.customer_id
    FROM basket_transition_log btl
    WHERE btl.from_basket_key = '40'
      AND btl.created_at >= '2026-03-01 00:00:00'
      AND btl.created_at < '2026-03-01 06:00:00'
);
