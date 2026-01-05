-- =============================================================================
-- SQL Script: อัปเดต lifecycle_status ตามเงื่อนไขใหม่
-- =============================================================================
-- เงื่อนไข:
-- 1. FollowUp = มี appointment ที่ status = 'ใหม่' (ยังไม่เสร็จสิ้น) กับผู้ดูแลปัจจุบัน
-- 2. Old3Months = ผู้ดูแลปัจจุบันขายได้ภายใน 3 เดือนล่าสุด
-- 3. New = ไม่เข้าเงื่อนไขข้างต้น (ผู้ดูแลปัจจุบันยังไม่เคยขายได้)
-- =============================================================================

-- ขั้นตอนที่ 1: เปลี่ยนเป็น New ก่อน (reset ทั้งหมด)
UPDATE customers SET lifecycle_status = 'New';

-- ขั้นตอนที่ 2: เปลี่ยนเป็น Old3Months สำหรับลูกค้าที่มีการซื้อภายใน 3 เดือนล่าสุดโดยผู้ดูแลปัจจุบัน
UPDATE customers c
SET c.lifecycle_status = 'Old3Months'
WHERE EXISTS (
    SELECT 1 FROM orders o
    WHERE o.customer_id = c.id
      AND o.creator_id = c.assigned_to
      AND o.order_status NOT IN ('Cancelled', 'BadDebt')
      AND o.order_date >= DATE_SUB(CURDATE(), INTERVAL 3 MONTH)
);

-- ขั้นตอนที่ 3: เปลี่ยนเป็น FollowUp สำหรับลูกค้าที่มี appointment ที่ยังไม่เสร็จสิ้น
UPDATE customers c
SET c.lifecycle_status = 'FollowUp'
WHERE EXISTS (
    SELECT 1 FROM appointments a
    WHERE a.customer_id = c.id
      AND a.status = 'ใหม่'
);

-- =============================================================================
-- ตรวจสอบผลลัพธ์
-- =============================================================================
SELECT 
    lifecycle_status,
    COUNT(*) as total
FROM customers
GROUP BY lifecycle_status
ORDER BY lifecycle_status;
